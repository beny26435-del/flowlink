// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FlowLinkV4
/// @notice Native Arc USDC checkout links, public slugs, creator profiles, and profile tip jars.
/// @dev Arc uses USDC as the native gas token. This contract accepts native
///      msg.value payments and does not call ERC20 transferFrom.
contract FlowLinkV4 {
    enum LinkMode {
        Payment,
        Invoice,
        Unlock,
        Group
    }

    struct Link {
        LinkMode mode;
        address creator;
        address payable recipient;
        uint256 amount;
        uint256 paidAmount;
        uint256 deadline;
        string title;
        string description;
        bool active;
        bool paid;
        address payer;
        uint256 paidAt;
        bytes32 receiptId;
        uint256 createdAt;
        uint256 cancelledAt;
        string clientName;
        string invoiceNumber;
        string serviceTitle;
        string successMessage;
        string unlockUrl;
        string slug;
        bool listed;
    }

    struct Profile {
        address owner;
        string username;
        string displayName;
        string bio;
        string avatarUrl;
        bool exists;
        uint256 createdAt;
        uint256 updatedAt;
        bool tipsEnabled;
        uint256 minimumTipAmount;
    }

    event ProfileUpserted(address indexed owner, string username, string displayName);
    event LinkCreated(
        uint256 indexed linkId,
        bytes32 indexed slugHash,
        address indexed creator,
        address recipient,
        LinkMode mode,
        uint256 amount,
        uint256 deadline,
        string slug,
        bool listed,
        string title
    );
    event LinkPaid(
        uint256 indexed linkId,
        bytes32 indexed slugHash,
        address indexed payer,
        address recipient,
        uint256 amount,
        bytes32 receiptId
    );
    event GroupContribution(
        uint256 indexed linkId,
        bytes32 indexed slugHash,
        address indexed contributor,
        uint256 amount,
        uint256 paidAmount,
        uint256 goalAmount
    );
    event GroupFunded(
        uint256 indexed linkId, bytes32 indexed slugHash, address indexed recipient, uint256 totalAmount, bytes32 receiptId
    );
    event GroupRefunded(uint256 indexed linkId, bytes32 indexed slugHash, address indexed contributor, uint256 amount);
    event ProfileTipReceived(
        address indexed creator,
        address indexed payer,
        uint256 amount,
        uint256 totalTipsReceived,
        bytes32 receiptId
    );
    event LinkCancelled(uint256 indexed linkId, bytes32 indexed slugHash, address indexed creator);

    error InvalidRecipient();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidLink();
    error NotCreator();
    error LinkInactive();
    error LinkAlreadyPaid();
    error LinkExpired();
    error WrongPaymentAmount();
    error TransferFailed();
    error Reentrancy();
    error InvalidTitle();
    error InvalidMode();
    error NotGroupLink();
    error GroupAlreadyFunded();
    error GroupNotExpired();
    error NoContribution();
    error CannotCancelFundedGroup();
    error InvalidSlug();
    error SlugAlreadyTaken();
    error InvalidUsername();
    error UsernameAlreadyTaken();
    error ProfileNotFound();
    error TipsDisabled();

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private constant _MAX_TITLE_LENGTH = 120;
    uint256 private constant _MAX_DESCRIPTION_LENGTH = 1000;
    uint256 private constant _MAX_UNLOCK_META_LENGTH = 500;
    uint256 private constant _MIN_SLUG_LENGTH = 6;
    uint256 private constant _MAX_SLUG_LENGTH = 64;
    uint256 private constant _MIN_USERNAME_LENGTH = 3;
    uint256 private constant _MAX_USERNAME_LENGTH = 32;
    uint256 private constant _MAX_DISPLAY_NAME_LENGTH = 80;
    uint256 private constant _MAX_BIO_LENGTH = 280;
    uint256 private constant _MAX_AVATAR_URL_LENGTH = 500;

    uint256 public nextLinkId = 1;

    mapping(uint256 => Link) private links;
    mapping(address => uint256[]) private linksByCreator;
    mapping(address => uint256[]) private linksByPayer;
    mapping(bytes32 => uint256) private linkIdBySlugHash;

    mapping(address => Profile) private profilesByAddress;
    mapping(bytes32 => address) private addressByUsernameHash;
    mapping(address => uint256[]) private listedLinksByCreator;

    mapping(uint256 => mapping(address => uint256)) public groupContributions;
    mapping(uint256 => address[]) private groupContributors;
    mapping(uint256 => mapping(address => bool)) private hasContributed;

    mapping(address => uint256) public totalTipsReceived;
    mapping(address => uint256) public tipCountReceived;
    mapping(address => mapping(address => uint256)) public tipsFromPayer;
    mapping(address => address[]) private profileTippers;
    mapping(address => mapping(address => bool)) private hasTippedProfile;

    uint256 private reentrancyStatus = _NOT_ENTERED;

    modifier nonReentrant() {
        if (reentrancyStatus == _ENTERED) revert Reentrancy();
        reentrancyStatus = _ENTERED;
        _;
        reentrancyStatus = _NOT_ENTERED;
    }

    function upsertProfile(
        string calldata username,
        string calldata displayName,
        string calldata bio,
        string calldata avatarUrl,
        bool tipsEnabled,
        uint256 minimumTipAmount
    ) external {
        _validateProfileMetadata(username, displayName, bio, avatarUrl);

        Profile storage profile = profilesByAddress[msg.sender];
        bytes32 oldUsernameHash = _usernameHash(profile.username);
        bytes32 newUsernameHash = _usernameHash(username);

        if (bytes(username).length != 0) {
            _validateUsername(username);
            address currentOwner = addressByUsernameHash[newUsernameHash];
            if (currentOwner != address(0) && currentOwner != msg.sender) revert UsernameAlreadyTaken();
        }

        if (oldUsernameHash != newUsernameHash) {
            if (oldUsernameHash != bytes32(0)) delete addressByUsernameHash[oldUsernameHash];
            if (newUsernameHash != bytes32(0)) addressByUsernameHash[newUsernameHash] = msg.sender;
        }

        if (!profile.exists) {
            profile.owner = msg.sender;
            profile.exists = true;
            profile.createdAt = block.timestamp;
        }

        profile.username = username;
        profile.displayName = displayName;
        profile.bio = bio;
        profile.avatarUrl = avatarUrl;
        profile.tipsEnabled = tipsEnabled;
        profile.minimumTipAmount = minimumTipAmount;
        profile.updatedAt = block.timestamp;

        emit ProfileUpserted(msg.sender, username, displayName);
    }

    function getProfileByAddress(address owner) external view returns (Profile memory) {
        Profile storage profile = profilesByAddress[owner];
        if (!profile.exists) revert ProfileNotFound();
        return profile;
    }

    function getProfileByUsername(string calldata username) external view returns (Profile memory) {
        address owner = addressByUsernameHash[_usernameHash(username)];
        if (owner == address(0)) revert ProfileNotFound();
        return profilesByAddress[owner];
    }

    function getAddressByUsername(string calldata username) external view returns (address) {
        return addressByUsernameHash[_usernameHash(username)];
    }

    function createPaymentLink(
        address payable recipient,
        uint256 amount,
        uint256 deadline,
        string calldata title,
        string calldata description,
        string calldata slug,
        bool listed
    ) external returns (uint256 linkId) {
        _validateRecipientAmountDeadline(recipient, amount, deadline);
        _validateTitle(title);
        _validateDescription(description);

        linkId = _createBaseLink(LinkMode.Payment, recipient, amount, deadline, title, description, slug, listed);
    }

    function createInvoiceLink(
        address payable recipient,
        uint256 amount,
        uint256 deadline,
        string calldata clientName,
        string calldata invoiceNumber,
        string calldata serviceTitle,
        string calldata description,
        string calldata slug,
        bool listed
    ) external returns (uint256 linkId) {
        _validateRecipientAmountDeadline(recipient, amount, deadline);
        _validateTitle(serviceTitle);
        _validateDescription(description);

        linkId = _createBaseLink(
            LinkMode.Invoice, recipient, amount, deadline, _invoiceTitle(invoiceNumber, serviceTitle), description, slug, listed
        );

        Link storage link = links[linkId];
        link.clientName = clientName;
        link.invoiceNumber = invoiceNumber;
        link.serviceTitle = serviceTitle;
    }

    function createUnlockLink(
        address payable recipient,
        uint256 amount,
        uint256 deadline,
        string calldata title,
        string calldata description,
        string calldata successMessage,
        string calldata unlockUrl,
        string calldata slug,
        bool listed
    ) external returns (uint256 linkId) {
        _validateRecipientAmountDeadline(recipient, amount, deadline);
        _validateTitle(title);
        _validateDescription(description);
        if (bytes(successMessage).length > _MAX_UNLOCK_META_LENGTH) revert InvalidLink();
        if (bytes(unlockUrl).length > _MAX_UNLOCK_META_LENGTH) revert InvalidLink();

        linkId = _createBaseLink(LinkMode.Unlock, recipient, amount, deadline, title, description, slug, listed);

        Link storage link = links[linkId];
        link.successMessage = successMessage;
        link.unlockUrl = unlockUrl;
    }

    function createGroupLink(
        address payable recipient,
        uint256 goalAmount,
        uint256 deadline,
        string calldata title,
        string calldata description,
        string calldata slug,
        bool listed
    ) external returns (uint256 linkId) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (goalAmount == 0) revert InvalidAmount();
        if (deadline == 0 || deadline <= block.timestamp) revert InvalidDeadline();
        _validateTitle(title);
        _validateDescription(description);

        linkId = _createBaseLink(LinkMode.Group, recipient, goalAmount, deadline, title, description, slug, listed);
    }

    function payLink(uint256 linkId) external payable nonReentrant {
        _payLink(linkId, msg.sender, msg.value);
    }

    function contributeGroup(uint256 linkId) external payable nonReentrant {
        _contributeGroup(linkId, msg.sender, msg.value);
    }

    function refundGroup(uint256 linkId) external nonReentrant {
        _refundGroup(linkId, msg.sender);
    }

    function tipProfile(address payable creator) external payable nonReentrant {
        _tipProfile(creator, msg.sender, msg.value);
    }

    function tipProfileByUsername(string calldata username) external payable nonReentrant {
        address owner = addressByUsernameHash[_usernameHash(username)];
        if (owner == address(0)) revert ProfileNotFound();
        _tipProfile(payable(owner), msg.sender, msg.value);
    }

    function cancelLink(uint256 linkId) external {
        _cancelLink(linkId, msg.sender);
    }

    function getLink(uint256 linkId) external view returns (Link memory) {
        Link storage link = _requireLink(linkId);
        return link;
    }

    function getLinkBySlug(string calldata slug) external view returns (Link memory) {
        Link storage link = _requireLink(_requireSlug(slug));
        return link;
    }

    function getLinkIdBySlug(string calldata slug) external view returns (uint256) {
        return _requireSlug(slug);
    }

    function getCreatorLinks(address creator) external view returns (uint256[] memory) {
        return linksByCreator[creator];
    }

    function getListedCreatorLinks(address creator) external view returns (uint256[] memory) {
        return listedLinksByCreator[creator];
    }

    function getPayerLinks(address payer) external view returns (uint256[] memory) {
        return linksByPayer[payer];
    }

    function getGroupContributors(uint256 linkId) external view returns (address[] memory) {
        Link storage link = _requireLink(linkId);
        if (link.mode != LinkMode.Group) revert NotGroupLink();
        return groupContributors[linkId];
    }

    function getGroupContribution(uint256 linkId, address contributor) external view returns (uint256) {
        Link storage link = _requireLink(linkId);
        if (link.mode != LinkMode.Group) revert NotGroupLink();
        return groupContributions[linkId][contributor];
    }

    function getProfileTippers(address creator) external view returns (address[] memory) {
        Profile storage profile = profilesByAddress[creator];
        if (!profile.exists) revert ProfileNotFound();
        return profileTippers[creator];
    }

    function getProfileTipFromPayer(address creator, address payer) external view returns (uint256) {
        Profile storage profile = profilesByAddress[creator];
        if (!profile.exists) revert ProfileNotFound();
        return tipsFromPayer[creator][payer];
    }

    function getProfileTipStats(address creator)
        external
        view
        returns (uint256 totalTips, uint256 tipCount, uint256 minimumTipAmount, bool tipsEnabled)
    {
        Profile storage profile = profilesByAddress[creator];
        if (!profile.exists) revert ProfileNotFound();
        return (totalTipsReceived[creator], tipCountReceived[creator], profile.minimumTipAmount, profile.tipsEnabled);
    }

    function getLinkStatus(uint256 linkId)
        public
        view
        returns (
            bool exists,
            bool active,
            bool paid,
            bool expired,
            bool cancelled,
            LinkMode mode,
            uint256 paidAmount,
            uint256 remainingAmount
        )
    {
        exists = _linkExists(linkId);
        if (!exists) return (false, false, false, false, false, LinkMode.Payment, 0, 0);

        Link storage link = links[linkId];
        active = link.active;
        paid = link.paid;
        expired = !link.paid && link.deadline != 0 && block.timestamp > link.deadline;
        cancelled = !link.active && !link.paid && link.cancelledAt != 0;
        mode = link.mode;
        paidAmount = link.paidAmount;
        remainingAmount = link.amount > link.paidAmount ? link.amount - link.paidAmount : 0;
    }

    function getLinkStatusBySlug(string calldata slug)
        external
        view
        returns (
            bool exists,
            bool active,
            bool paid,
            bool expired,
            bool cancelled,
            LinkMode mode,
            uint256 paidAmount,
            uint256 remainingAmount
        )
    {
        return getLinkStatus(_requireSlug(slug));
    }

    function isPayable(uint256 linkId) public view returns (bool) {
        if (!_linkExists(linkId)) return false;

        Link storage link = links[linkId];
        if (!link.active || _isExpired(link)) return false;
        if (link.paid) return false;
        if (link.mode == LinkMode.Group) return link.paidAmount < link.amount;
        return true;
    }

    function isPayableBySlug(string calldata slug) external view returns (bool) {
        return isPayable(_requireSlug(slug));
    }

    receive() external payable {
        revert InvalidLink();
    }

    fallback() external payable {
        revert InvalidLink();
    }

    function _payLink(uint256 linkId, address payer, uint256 value) private {
        Link storage link = _requireLink(linkId);
        if (link.mode == LinkMode.Group) revert NotGroupLink();
        if (link.paid) revert LinkAlreadyPaid();
        if (!link.active) revert LinkInactive();
        if (_isExpired(link)) revert LinkExpired();
        if (value != link.amount) revert WrongPaymentAmount();

        bytes32 slugHash = _slugHash(link.slug);
        bytes32 receiptId =
            keccak256(abi.encodePacked(address(this), block.chainid, linkId, payer, link.recipient, value, block.timestamp));

        link.paid = true;
        link.active = false;
        link.payer = payer;
        link.paidAt = block.timestamp;
        link.paidAmount = value;
        link.receiptId = receiptId;

        linksByPayer[payer].push(linkId);

        (bool success,) = link.recipient.call{value: value}("");
        if (!success) revert TransferFailed();

        emit LinkPaid(linkId, slugHash, payer, link.recipient, value, receiptId);
    }

    function _contributeGroup(uint256 linkId, address contributor, uint256 value) private {
        Link storage link = _requireLink(linkId);
        if (link.mode != LinkMode.Group) revert NotGroupLink();
        if (link.paid) revert GroupAlreadyFunded();
        if (!link.active) revert LinkInactive();
        if (_isExpired(link)) revert LinkExpired();
        if (value == 0) revert InvalidAmount();

        uint256 remaining = link.amount - link.paidAmount;
        if (value > remaining) revert InvalidAmount();

        if (!hasContributed[linkId][contributor]) {
            hasContributed[linkId][contributor] = true;
            groupContributors[linkId].push(contributor);
        }

        groupContributions[linkId][contributor] += value;
        link.paidAmount += value;

        bytes32 slugHash = _slugHash(link.slug);
        emit GroupContribution(linkId, slugHash, contributor, value, link.paidAmount, link.amount);

        if (link.paidAmount == link.amount) {
            bytes32 receiptId = keccak256(
                abi.encodePacked(
                    address(this), block.chainid, linkId, contributor, link.recipient, link.paidAmount, block.timestamp, "GROUP"
                )
            );

            link.paid = true;
            link.active = false;
            // For Group links, payer records the contributor whose payment completed the funding goal.
            link.payer = contributor;
            link.paidAt = block.timestamp;
            link.receiptId = receiptId;

            linksByPayer[contributor].push(linkId);

            (bool success,) = link.recipient.call{value: link.paidAmount}("");
            if (!success) revert TransferFailed();

            emit GroupFunded(linkId, slugHash, link.recipient, link.paidAmount, receiptId);
        }
    }

    function _refundGroup(uint256 linkId, address contributor) private {
        Link storage link = _requireLink(linkId);
        if (link.mode != LinkMode.Group) revert NotGroupLink();
        if (link.paid) revert GroupAlreadyFunded();

        uint256 contribution = groupContributions[linkId][contributor];
        if (contribution == 0) revert NoContribution();
        if (!_isExpired(link) && link.cancelledAt == 0) revert GroupNotExpired();

        groupContributions[linkId][contributor] = 0;
        link.paidAmount -= contribution;

        (bool success,) = payable(contributor).call{value: contribution}("");
        if (!success) revert TransferFailed();

        emit GroupRefunded(linkId, _slugHash(link.slug), contributor, contribution);
    }

    function _tipProfile(address payable creator, address payer, uint256 value) private {
        if (creator == address(0)) revert InvalidRecipient();
        Profile storage profile = profilesByAddress[creator];
        if (!profile.exists) revert ProfileNotFound();
        if (!profile.tipsEnabled) revert TipsDisabled();
        if (value == 0) revert InvalidAmount();
        if (profile.minimumTipAmount != 0 && value < profile.minimumTipAmount) revert InvalidAmount();

        bytes32 receiptId = keccak256(
            abi.encodePacked(address(this), block.chainid, creator, payer, value, block.timestamp, "PROFILE_TIP")
        );

        totalTipsReceived[creator] += value;
        tipCountReceived[creator] += 1;
        tipsFromPayer[creator][payer] += value;

        if (!hasTippedProfile[creator][payer]) {
            hasTippedProfile[creator][payer] = true;
            profileTippers[creator].push(payer);
        }

        (bool success,) = creator.call{value: value}("");
        if (!success) revert TransferFailed();

        emit ProfileTipReceived(creator, payer, value, totalTipsReceived[creator], receiptId);
    }

    function _cancelLink(uint256 linkId, address caller) private {
        Link storage link = _requireLink(linkId);
        if (caller != link.creator) revert NotCreator();

        if (link.mode == LinkMode.Group) {
            if (link.paid) revert CannotCancelFundedGroup();
        } else {
            if (link.paid) revert LinkAlreadyPaid();
        }

        if (!link.active) revert LinkInactive();

        link.active = false;
        link.cancelledAt = block.timestamp;

        emit LinkCancelled(linkId, _slugHash(link.slug), caller);
    }

    function _createBaseLink(
        LinkMode mode,
        address payable recipient,
        uint256 amount,
        uint256 deadline,
        string memory title,
        string memory description,
        string calldata slug,
        bool listed
    ) private returns (uint256 linkId) {
        _validateSlug(slug);
        bytes32 slugHash = _slugHash(slug);
        if (linkIdBySlugHash[slugHash] != 0) revert SlugAlreadyTaken();

        linkId = nextLinkId++;

        links[linkId] = Link({
            mode: mode,
            creator: msg.sender,
            recipient: recipient,
            amount: amount,
            paidAmount: 0,
            deadline: deadline,
            title: title,
            description: description,
            active: true,
            paid: false,
            payer: address(0),
            paidAt: 0,
            receiptId: bytes32(0),
            createdAt: block.timestamp,
            cancelledAt: 0,
            clientName: "",
            invoiceNumber: "",
            serviceTitle: "",
            successMessage: "",
            unlockUrl: "",
            slug: slug,
            listed: listed
        });

        linkIdBySlugHash[slugHash] = linkId;
        linksByCreator[msg.sender].push(linkId);
        if (listed) listedLinksByCreator[msg.sender].push(linkId);

        emit LinkCreated(linkId, slugHash, msg.sender, recipient, mode, amount, deadline, slug, listed, title);
    }

    function _validateRecipientAmountDeadline(address recipient, uint256 amount, uint256 deadline) private view {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (deadline != 0 && deadline <= block.timestamp) revert InvalidDeadline();
    }

    function _invoiceTitle(string calldata invoiceNumber, string calldata serviceTitle)
        private
        pure
        returns (string memory)
    {
        return bytes(invoiceNumber).length == 0
            ? string.concat(unicode"Invoice — ", serviceTitle)
            : string.concat("Invoice #", invoiceNumber, unicode" — ", serviceTitle);
    }

    function _validateTitle(string memory title) private pure {
        uint256 length = bytes(title).length;
        if (length == 0 || length > _MAX_TITLE_LENGTH) revert InvalidTitle();
    }

    function _validateDescription(string memory description) private pure {
        if (bytes(description).length > _MAX_DESCRIPTION_LENGTH) revert InvalidLink();
    }

    function _validateProfileMetadata(
        string calldata username,
        string calldata displayName,
        string calldata bio,
        string calldata avatarUrl
    ) private pure {
        if (bytes(username).length > _MAX_USERNAME_LENGTH) revert InvalidUsername();
        if (bytes(displayName).length > _MAX_DISPLAY_NAME_LENGTH) revert InvalidLink();
        if (bytes(bio).length > _MAX_BIO_LENGTH) revert InvalidLink();
        if (bytes(avatarUrl).length > _MAX_AVATAR_URL_LENGTH) revert InvalidLink();
    }

    function _validateSlug(string calldata slug) private pure {
        bytes memory value = bytes(slug);
        if (value.length < _MIN_SLUG_LENGTH || value.length > _MAX_SLUG_LENGTH) revert InvalidSlug();

        for (uint256 i = 0; i < value.length; i++) {
            bytes1 char = value[i];
            bool allowed = (char >= 0x61 && char <= 0x7A) || (char >= 0x41 && char <= 0x5A)
                || (char >= 0x30 && char <= 0x39) || char == 0x2D || char == 0x5F;
            if (!allowed) revert InvalidSlug();
        }
    }

    function _validateUsername(string calldata username) private pure {
        bytes memory value = bytes(username);
        if (value.length < _MIN_USERNAME_LENGTH || value.length > _MAX_USERNAME_LENGTH) revert InvalidUsername();

        for (uint256 i = 0; i < value.length; i++) {
            bytes1 char = value[i];
            bool allowed =
                (char >= 0x61 && char <= 0x7A) || (char >= 0x30 && char <= 0x39) || char == 0x2D || char == 0x5F;
            if (!allowed) revert InvalidUsername();
        }
    }

    function _requireLink(uint256 linkId) private view returns (Link storage link) {
        if (!_linkExists(linkId)) revert InvalidLink();
        return links[linkId];
    }

    function _requireSlug(string calldata slug) private view returns (uint256 linkId) {
        linkId = linkIdBySlugHash[_slugHash(slug)];
        if (linkId == 0) revert InvalidLink();
    }

    function _linkExists(uint256 linkId) private view returns (bool) {
        return linkId != 0 && linkId < nextLinkId;
    }

    function _isExpired(Link storage link) private view returns (bool) {
        return link.deadline != 0 && block.timestamp > link.deadline;
    }

    function _slugHash(string memory slug) private pure returns (bytes32) {
        return keccak256(bytes(slug));
    }

    function _usernameHash(string memory username) private pure returns (bytes32) {
        if (bytes(username).length == 0) return bytes32(0);
        return keccak256(bytes(username));
    }
}
