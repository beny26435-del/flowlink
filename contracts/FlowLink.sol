// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FlowLink
/// @notice Native Arc USDC payment links.
/// @dev Arc uses USDC as the native gas token, so v1 accepts exact native
///      value payments through msg.value instead of ERC20 transferFrom.
contract FlowLink {
    struct PaymentLink {
        address creator;
        address payable recipient;
        uint256 amount;
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
    }

    event LinkCreated(
        uint256 indexed linkId,
        address indexed creator,
        address indexed recipient,
        uint256 amount,
        uint256 deadline,
        string title
    );

    event LinkPaid(
        uint256 indexed linkId, address indexed payer, address indexed recipient, uint256 amount, bytes32 receiptId
    );

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

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 public nextLinkId = 1;

    mapping(uint256 => PaymentLink) private links;
    mapping(address => uint256[]) private linksByCreator;
    mapping(address => uint256[]) private linksByPayer;

    uint256 private reentrancyStatus = _NOT_ENTERED;

    modifier nonReentrant() {
        if (reentrancyStatus == _ENTERED) revert Reentrancy();
        reentrancyStatus = _ENTERED;
        _;
        reentrancyStatus = _NOT_ENTERED;
    }

    function createLink(
        address payable recipient,
        uint256 amount,
        uint256 deadline,
        string calldata title,
        string calldata description
    ) external returns (uint256 linkId) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (deadline != 0 && deadline <= block.timestamp) revert InvalidDeadline();
        if (bytes(title).length == 0 || bytes(title).length > 120) revert InvalidLink();
        if (bytes(description).length > 1000) revert InvalidLink();

        linkId = nextLinkId++;

        links[linkId] = PaymentLink({
            creator: msg.sender,
            recipient: recipient,
            amount: amount,
            deadline: deadline,
            title: title,
            description: description,
            active: true,
            paid: false,
            payer: address(0),
            paidAt: 0,
            receiptId: bytes32(0),
            createdAt: block.timestamp,
            cancelledAt: 0
        });

        linksByCreator[msg.sender].push(linkId);

        emit LinkCreated(linkId, msg.sender, recipient, amount, deadline, title);
    }

    function payLink(uint256 linkId) external payable nonReentrant {
        PaymentLink storage link = _requireLink(linkId);

        if (link.paid) revert LinkAlreadyPaid();
        if (!link.active) revert LinkInactive();
        if (link.deadline != 0 && block.timestamp > link.deadline) revert LinkExpired();
        if (msg.value != link.amount) revert WrongPaymentAmount();

        bytes32 receiptId = keccak256(
            abi.encodePacked(
                address(this), block.chainid, linkId, msg.sender, link.recipient, msg.value, block.timestamp
            )
        );

        link.paid = true;
        link.active = false;
        link.payer = msg.sender;
        link.paidAt = block.timestamp;
        link.receiptId = receiptId;

        linksByPayer[msg.sender].push(linkId);

        (bool success,) = link.recipient.call{value: msg.value}("");
        if (!success) revert TransferFailed();

        emit LinkPaid(linkId, msg.sender, link.recipient, msg.value, receiptId);
    }

    function cancelLink(uint256 linkId) external {
        PaymentLink storage link = _requireLink(linkId);

        if (msg.sender != link.creator) revert NotCreator();
        if (link.paid) revert LinkAlreadyPaid();
        if (!link.active) revert LinkInactive();

        link.active = false;
        link.cancelledAt = block.timestamp;

        emit LinkCancelled(linkId, msg.sender);
    }

    function getLink(uint256 linkId) external view returns (PaymentLink memory) {
        PaymentLink storage link = _requireLink(linkId);
        return link;
    }

    function getCreatorLinks(address creator) external view returns (uint256[] memory) {
        return linksByCreator[creator];
    }

    function getPayerLinks(address payer) external view returns (uint256[] memory) {
        return linksByPayer[payer];
    }

    function getLinkStatus(uint256 linkId)
        external
        view
        returns (bool exists, bool active, bool paid, bool expired, bool cancelled)
    {
        exists = _linkExists(linkId);
        if (!exists) return (false, false, false, false, false);

        PaymentLink storage link = links[linkId];
        active = link.active;
        paid = link.paid;
        expired = !link.paid && link.deadline != 0 && block.timestamp > link.deadline;
        cancelled = !link.active && !link.paid && link.cancelledAt != 0;
    }

    function isPayable(uint256 linkId) external view returns (bool) {
        if (!_linkExists(linkId)) return false;

        PaymentLink storage link = links[linkId];
        bool expired = link.deadline != 0 && block.timestamp > link.deadline;
        return link.active && !link.paid && !expired;
    }

    receive() external payable {
        revert InvalidLink();
    }

    fallback() external payable {
        revert InvalidLink();
    }

    function _requireLink(uint256 linkId) private view returns (PaymentLink storage link) {
        if (!_linkExists(linkId)) revert InvalidLink();
        return links[linkId];
    }

    function _linkExists(uint256 linkId) private view returns (bool) {
        return linkId != 0 && linkId < nextLinkId;
    }
}
