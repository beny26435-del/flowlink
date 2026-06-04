// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FlowLinkV2
/// @notice Multi-mode native Arc USDC checkout links.
/// @dev Arc uses USDC as the native gas token. This contract accepts native
///      msg.value payments and does not call ERC20 transferFrom.
contract FlowLinkV2 {
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
    }

    event LinkCreated(
        uint256 indexed linkId,
        address indexed creator,
        address indexed recipient,
        LinkMode mode,
        uint256 amount,
        uint256 deadline,
        string title
    );
    event LinkPaid(
        uint256 indexed linkId, address indexed payer, address indexed recipient, uint256 amount, bytes32 receiptId
    );
    event GroupContribution(
        uint256 indexed linkId, address indexed contributor, uint256 amount, uint256 paidAmount, uint256 goalAmount
    );
    event GroupFunded(uint256 indexed linkId, address indexed recipient, uint256 totalAmount, bytes32 receiptId);
    event GroupRefunded(uint256 indexed linkId, address indexed contributor, uint256 amount);
    event LinkCancelled(uint256 indexed linkId, address indexed creator);

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

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private constant _MAX_TITLE_LENGTH = 120;
    uint256 private constant _MAX_DESCRIPTION_LENGTH = 1000;
    uint256 private constant _MAX_UNLOCK_META_LENGTH = 500;

    uint256 public nextLinkId = 1;

    mapping(uint256 => Link) private links;
    mapping(address => uint256[]) private linksByCreator;
    mapping(address => uint256[]) private linksByPayer;

    mapping(uint256 => mapping(address => uint256)) public groupContributions;
    mapping(uint256 => address[]) private groupContributors;
    mapping(uint256 => mapping(address => bool)) private hasContributed;

    uint256 private reentrancyStatus = _NOT_ENTERED;

    modifier nonReentrant() {
        if (reentrancyStatus == _ENTERED) revert Reentrancy();
        reentrancyStatus = _ENTERED;
        _;
        reentrancyStatus = _NOT_ENTERED;
    }

    function createPaymentLink(
        address payable recipient,
        uint256 amount,
        uint256 deadline,
        string calldata title,
        string calldata description
    ) external returns (uint256 linkId) {
        _validateRecipientAmountDeadline(recipient, amount, deadline);
        _validateTitle(title);
        _validateDescription(description);

        linkId = _createBaseLink(LinkMode.Payment, recipient, amount, deadline, title, description);
    }

    function createInvoiceLink(
        address payable recipient,
        uint256 amount,
        uint256 deadline,
        string calldata clientName,
        string calldata invoiceNumber,
        string calldata serviceTitle,
        string calldata description
    ) external returns (uint256 linkId) {
        _validateRecipientAmountDeadline(recipient, amount, deadline);
        _validateTitle(serviceTitle);
        _validateDescription(description);

        string memory title = bytes(invoiceNumber).length == 0
            ? string.concat(unicode"Invoice — ", serviceTitle)
            : string.concat("Invoice #", invoiceNumber, unicode" — ", serviceTitle);

        linkId = _createBaseLink(LinkMode.Invoice, recipient, amount, deadline, title, description);

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
        string calldata unlockUrl
    ) external returns (uint256 linkId) {
        _validateRecipientAmountDeadline(recipient, amount, deadline);
        _validateTitle(title);
        _validateDescription(description);
        if (bytes(successMessage).length > _MAX_UNLOCK_META_LENGTH) revert InvalidLink();
        if (bytes(unlockUrl).length > _MAX_UNLOCK_META_LENGTH) revert InvalidLink();

        linkId = _createBaseLink(LinkMode.Unlock, recipient, amount, deadline, title, description);

        Link storage link = links[linkId];
        link.successMessage = successMessage;
        link.unlockUrl = unlockUrl;
    }

    function createGroupLink(
        address payable recipient,
        uint256 goalAmount,
        uint256 deadline,
        string calldata title,
        string calldata description
    ) external returns (uint256 linkId) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (goalAmount == 0) revert InvalidAmount();
        if (deadline == 0 || deadline <= block.timestamp) revert InvalidDeadline();
        _validateTitle(title);
        _validateDescription(description);

        linkId = _createBaseLink(LinkMode.Group, recipient, goalAmount, deadline, title, description);
    }

    function payLink(uint256 linkId) external payable nonReentrant {
        Link storage link = _requireLink(linkId);
        if (link.mode == LinkMode.Group) revert NotGroupLink();
        if (link.paid) revert LinkAlreadyPaid();
        if (!link.active) revert LinkInactive();
        if (_isExpired(link)) revert LinkExpired();
        if (msg.value != link.amount) revert WrongPaymentAmount();

        bytes32 receiptId = keccak256(
            abi.encodePacked(address(this), block.chainid, linkId, msg.sender, link.recipient, msg.value, block.timestamp)
        );

        link.paid = true;
        link.active = false;
        link.payer = msg.sender;
        link.paidAt = block.timestamp;
        link.paidAmount = msg.value;
        link.receiptId = receiptId;

        linksByPayer[msg.sender].push(linkId);

        (bool success,) = link.recipient.call{value: msg.value}("");
        if (!success) revert TransferFailed();

        emit LinkPaid(linkId, msg.sender, link.recipient, msg.value, receiptId);
    }

    function contributeGroup(uint256 linkId) external payable nonReentrant {
        Link storage link = _requireLink(linkId);
        if (link.mode != LinkMode.Group) revert NotGroupLink();
        if (link.paid) revert GroupAlreadyFunded();
        if (!link.active) revert LinkInactive();
        if (_isExpired(link)) revert LinkExpired();
        if (msg.value == 0) revert InvalidAmount();

        uint256 remaining = link.amount - link.paidAmount;
        if (msg.value > remaining) revert InvalidAmount();

        if (!hasContributed[linkId][msg.sender]) {
            hasContributed[linkId][msg.sender] = true;
            groupContributors[linkId].push(msg.sender);
        }

        groupContributions[linkId][msg.sender] += msg.value;
        link.paidAmount += msg.value;

        emit GroupContribution(linkId, msg.sender, msg.value, link.paidAmount, link.amount);

        if (link.paidAmount == link.amount) {
            bytes32 receiptId = keccak256(
                abi.encodePacked(
                    address(this), block.chainid, linkId, msg.sender, link.recipient, link.paidAmount, block.timestamp, "GROUP"
                )
            );

            link.paid = true;
            link.active = false;
            // For Group links, payer records the contributor whose payment completed the funding goal.
            link.payer = msg.sender;
            link.paidAt = block.timestamp;
            link.receiptId = receiptId;

            linksByPayer[msg.sender].push(linkId);

            (bool success,) = link.recipient.call{value: link.paidAmount}("");
            if (!success) revert TransferFailed();

            emit GroupFunded(linkId, link.recipient, link.paidAmount, receiptId);
        }
    }

    function refundGroup(uint256 linkId) external nonReentrant {
        Link storage link = _requireLink(linkId);
        if (link.mode != LinkMode.Group) revert NotGroupLink();
        if (link.paid) revert GroupAlreadyFunded();

        uint256 contribution = groupContributions[linkId][msg.sender];
        if (contribution == 0) revert NoContribution();
        if (!_isExpired(link) && link.cancelledAt == 0) revert GroupNotExpired();

        groupContributions[linkId][msg.sender] = 0;
        link.paidAmount -= contribution;

        (bool success,) = payable(msg.sender).call{value: contribution}("");
        if (!success) revert TransferFailed();

        emit GroupRefunded(linkId, msg.sender, contribution);
    }

    function cancelLink(uint256 linkId) external {
        Link storage link = _requireLink(linkId);
        if (msg.sender != link.creator) revert NotCreator();

        if (link.mode == LinkMode.Group) {
            if (link.paid) revert CannotCancelFundedGroup();
        } else {
            if (link.paid) revert LinkAlreadyPaid();
        }

        if (!link.active) revert LinkInactive();

        link.active = false;
        link.cancelledAt = block.timestamp;

        emit LinkCancelled(linkId, msg.sender);
    }

    function getLink(uint256 linkId) external view returns (Link memory) {
        Link storage link = _requireLink(linkId);
        return link;
    }

    function getCreatorLinks(address creator) external view returns (uint256[] memory) {
        return linksByCreator[creator];
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

    function getLinkStatus(uint256 linkId)
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

    function isPayable(uint256 linkId) external view returns (bool) {
        if (!_linkExists(linkId)) return false;

        Link storage link = links[linkId];
        if (!link.active || link.paid || _isExpired(link)) return false;
        if (link.mode == LinkMode.Group) return link.paidAmount < link.amount;
        return true;
    }

    receive() external payable {
        revert InvalidLink();
    }

    fallback() external payable {
        revert InvalidLink();
    }

    function _createBaseLink(
        LinkMode mode,
        address payable recipient,
        uint256 amount,
        uint256 deadline,
        string memory title,
        string memory description
    ) private returns (uint256 linkId) {
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
            unlockUrl: ""
        });

        linksByCreator[msg.sender].push(linkId);

        emit LinkCreated(linkId, msg.sender, recipient, mode, amount, deadline, title);
    }

    function _validateRecipientAmountDeadline(address recipient, uint256 amount, uint256 deadline) private view {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (deadline != 0 && deadline <= block.timestamp) revert InvalidDeadline();
    }

    function _validateTitle(string memory title) private pure {
        uint256 length = bytes(title).length;
        if (length == 0 || length > _MAX_TITLE_LENGTH) revert InvalidTitle();
    }

    function _validateDescription(string memory description) private pure {
        if (bytes(description).length > _MAX_DESCRIPTION_LENGTH) revert InvalidLink();
    }

    function _requireLink(uint256 linkId) private view returns (Link storage link) {
        if (!_linkExists(linkId)) revert InvalidLink();
        return links[linkId];
    }

    function _linkExists(uint256 linkId) private view returns (bool) {
        return linkId != 0 && linkId < nextLinkId;
    }

    function _isExpired(Link storage link) private view returns (bool) {
        return link.deadline != 0 && block.timestamp > link.deadline;
    }
}
