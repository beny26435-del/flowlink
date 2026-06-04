// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FlowLinkV2} from "../contracts/FlowLinkV2.sol";

contract FlowLinkV2Test is Test {
    FlowLinkV2 internal flowLink;

    address internal creator = address(0xA11CE);
    address payable internal recipient = payable(address(0xB0B));
    address internal payer = address(0xCAFE);
    address internal contributorA = address(0xAAA1);
    address internal contributorB = address(0xBBB2);

    uint256 internal constant AMOUNT = 1 ether;
    uint256 internal constant GOAL = 3 ether;

    function setUp() public {
        flowLink = new FlowLinkV2();

        vm.deal(payer, 20 ether);
        vm.deal(contributorA, 20 ether);
        vm.deal(contributorB, 20 ether);
    }

    function testCreatePaymentLink() public {
        uint256 linkId = _createPayment();

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertEq(uint256(link.mode), uint256(FlowLinkV2.LinkMode.Payment));
        assertEq(link.creator, creator);
        assertEq(link.recipient, recipient);
        assertEq(link.amount, AMOUNT);
        assertEq(link.title, "Payment");
        assertEq(link.description, "Description");
        assertTrue(link.active);
        assertFalse(link.paid);
    }

    function testPayExactAmount() public {
        uint256 linkId = _createPayment();
        uint256 beforeBalance = recipient.balance;

        vm.prank(payer);
        flowLink.payLink{value: AMOUNT}(linkId);

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertTrue(link.paid);
        assertFalse(link.active);
        assertEq(link.payer, payer);
        assertEq(link.paidAmount, AMOUNT);
        assertEq(recipient.balance - beforeBalance, AMOUNT);
        assertTrue(link.receiptId != bytes32(0));
    }

    function testWrongPaymentAmountReverts() public {
        uint256 linkId = _createPayment();

        vm.prank(payer);
        vm.expectRevert(FlowLinkV2.WrongPaymentAmount.selector);
        flowLink.payLink{value: AMOUNT - 1}(linkId);
    }

    function testCancelUnpaidAndCannotPayCancelled() public {
        uint256 linkId = _createPayment();

        vm.prank(creator);
        flowLink.cancelLink(linkId);

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertFalse(link.active);
        assertGt(link.cancelledAt, 0);

        vm.prank(payer);
        vm.expectRevert(FlowLinkV2.LinkInactive.selector);
        flowLink.payLink{value: AMOUNT}(linkId);
    }

    function testCannotCancelPaid() public {
        uint256 linkId = _createPayment();

        vm.prank(payer);
        flowLink.payLink{value: AMOUNT}(linkId);

        vm.prank(creator);
        vm.expectRevert(FlowLinkV2.LinkAlreadyPaid.selector);
        flowLink.cancelLink(linkId);
    }

    function testPaymentDeadlineBehavior() public {
        vm.prank(creator);
        uint256 linkId = flowLink.createPaymentLink(recipient, AMOUNT, block.timestamp + 1 days, "Payment", "");

        vm.warp(block.timestamp + 2 days);

        vm.prank(payer);
        vm.expectRevert(FlowLinkV2.LinkExpired.selector);
        flowLink.payLink{value: AMOUNT}(linkId);
    }

    function testCreateInvoiceStoresFieldsAndGeneratedTitle() public {
        uint256 linkId = _createInvoice("INV-100");

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertEq(uint256(link.mode), uint256(FlowLinkV2.LinkMode.Invoice));
        assertEq(link.clientName, "Acme");
        assertEq(link.invoiceNumber, "INV-100");
        assertEq(link.serviceTitle, "Design Sprint");
        assertEq(link.title, unicode"Invoice #INV-100 — Design Sprint");
    }

    function testInvoiceTitleWithoutInvoiceNumber() public {
        uint256 linkId = _createInvoice("");

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertEq(link.title, unicode"Invoice — Design Sprint");
    }

    function testPayInvoiceWorks() public {
        uint256 linkId = _createInvoice("INV-101");

        vm.prank(payer);
        flowLink.payLink{value: AMOUNT}(linkId);

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertTrue(link.paid);
        assertEq(link.payer, payer);
    }

    function testCreateUnlockStoresMetadataAndPayWorks() public {
        uint256 linkId = _createUnlock();

        FlowLinkV2.Link memory beforePay = flowLink.getLink(linkId);
        assertEq(uint256(beforePay.mode), uint256(FlowLinkV2.LinkMode.Unlock));
        assertEq(beforePay.successMessage, "Welcome");
        assertEq(beforePay.unlockUrl, "https://example.com/unlock");

        vm.prank(payer);
        flowLink.payLink{value: AMOUNT}(linkId);

        FlowLinkV2.Link memory afterPay = flowLink.getLink(linkId);
        assertTrue(afterPay.paid);
        assertEq(afterPay.successMessage, "Welcome");
        assertEq(afterPay.unlockUrl, "https://example.com/unlock");
    }

    function testCreateGroupRequiresFutureDeadline() public {
        vm.startPrank(creator);
        vm.expectRevert(FlowLinkV2.InvalidDeadline.selector);
        flowLink.createGroupLink(recipient, GOAL, 0, "Group", "");

        vm.expectRevert(FlowLinkV2.InvalidDeadline.selector);
        flowLink.createGroupLink(recipient, GOAL, block.timestamp, "Group", "");
        vm.stopPrank();
    }

    function testCreateGroupStoresGoalAmount() public {
        uint256 linkId = _createGroup();

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertEq(uint256(link.mode), uint256(FlowLinkV2.LinkMode.Group));
        assertEq(link.amount, GOAL);
        assertEq(link.paidAmount, 0);
        assertTrue(link.active);
    }

    function testContributePartialAndMultipleContributors() public {
        uint256 linkId = _createGroup();

        vm.prank(contributorA);
        flowLink.contributeGroup{value: 1 ether}(linkId);

        vm.prank(contributorB);
        flowLink.contributeGroup{value: 1 ether}(linkId);

        assertEq(flowLink.getGroupContribution(linkId, contributorA), 1 ether);
        assertEq(flowLink.getGroupContribution(linkId, contributorB), 1 ether);
        assertEq(flowLink.getGroupContributors(linkId).length, 2);

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertEq(link.paidAmount, 2 ether);
        assertFalse(link.paid);
    }

    function testGroupOverContributionReverts() public {
        uint256 linkId = _createGroup();

        vm.prank(contributorA);
        vm.expectRevert(FlowLinkV2.InvalidAmount.selector);
        flowLink.contributeGroup{value: GOAL + 1}(linkId);
    }

    function testFinalContributionFundsGroupAndTransfers() public {
        uint256 linkId = _createGroup();
        uint256 beforeBalance = recipient.balance;

        vm.prank(contributorA);
        flowLink.contributeGroup{value: 1 ether}(linkId);

        vm.prank(contributorB);
        flowLink.contributeGroup{value: 2 ether}(linkId);

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertTrue(link.paid);
        assertFalse(link.active);
        assertEq(link.payer, contributorB);
        assertEq(link.paidAmount, GOAL);
        assertEq(recipient.balance - beforeBalance, GOAL);
        assertTrue(link.receiptId != bytes32(0));

        uint256[] memory payerLinks = flowLink.getPayerLinks(contributorB);
        assertEq(payerLinks.length, 1);
        assertEq(payerLinks[0], linkId);
    }

    function testCannotContributeAfterFunded() public {
        uint256 linkId = _createGroup();

        vm.prank(contributorA);
        flowLink.contributeGroup{value: GOAL}(linkId);

        vm.prank(contributorB);
        vm.expectRevert(FlowLinkV2.GroupAlreadyFunded.selector);
        flowLink.contributeGroup{value: 1}(linkId);
    }

    function testRefundAfterDeadlineIfNotFunded() public {
        uint256 linkId = _createGroup();

        vm.prank(contributorA);
        flowLink.contributeGroup{value: 1 ether}(linkId);

        vm.warp(block.timestamp + 8 days);
        uint256 beforeBalance = contributorA.balance;

        vm.prank(contributorA);
        flowLink.refundGroup(linkId);

        assertEq(contributorA.balance - beforeBalance, 1 ether);
        assertEq(flowLink.getGroupContribution(linkId, contributorA), 0);
    }

    function testCannotRefundBeforeDeadlineOrWithoutContribution() public {
        uint256 linkId = _createGroup();

        vm.prank(contributorA);
        flowLink.contributeGroup{value: 1 ether}(linkId);

        vm.prank(contributorA);
        vm.expectRevert(FlowLinkV2.GroupNotExpired.selector);
        flowLink.refundGroup(linkId);

        vm.warp(block.timestamp + 8 days);
        vm.prank(contributorB);
        vm.expectRevert(FlowLinkV2.NoContribution.selector);
        flowLink.refundGroup(linkId);
    }

    function testCancelGroupNoContributions() public {
        uint256 linkId = _createGroup();

        vm.prank(creator);
        flowLink.cancelLink(linkId);

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertFalse(link.active);
        assertGt(link.cancelledAt, 0);
    }

    function testCancelGroupWithContributionsThenRefund() public {
        uint256 linkId = _createGroup();

        vm.prank(contributorA);
        flowLink.contributeGroup{value: 1 ether}(linkId);

        vm.prank(creator);
        flowLink.cancelLink(linkId);

        uint256 beforeBalance = contributorA.balance;
        vm.prank(contributorA);
        flowLink.refundGroup(linkId);
        assertEq(contributorA.balance - beforeBalance, 1 ether);
    }

    function testCannotCancelFundedGroup() public {
        uint256 linkId = _createGroup();

        vm.prank(contributorA);
        flowLink.contributeGroup{value: GOAL}(linkId);

        vm.prank(creator);
        vm.expectRevert(FlowLinkV2.CannotCancelFundedGroup.selector);
        flowLink.cancelLink(linkId);
    }

    function testPayLinkReentrancyGuard() public {
        ReenteringRecipient attacker = new ReenteringRecipient(flowLink);
        vm.deal(address(attacker), AMOUNT);

        vm.prank(creator);
        uint256 linkId = flowLink.createPaymentLink(payable(address(attacker)), AMOUNT, 0, "Payment", "");
        attacker.setPayAttack(linkId, AMOUNT);

        vm.prank(payer);
        flowLink.payLink{value: AMOUNT}(linkId);

        assertTrue(attacker.sawReentrancy());
        assertTrue(flowLink.getLink(linkId).paid);
    }

    function testContributeGroupReentrancyGuard() public {
        ReenteringRecipient attacker = new ReenteringRecipient(flowLink);
        vm.prank(creator);
        uint256 linkId = flowLink.createGroupLink(payable(address(attacker)), GOAL, block.timestamp + 7 days, "Group", "");
        attacker.setContributeAttack(linkId);

        vm.prank(contributorA);
        flowLink.contributeGroup{value: GOAL}(linkId);

        assertTrue(attacker.sawReentrancy());
        assertTrue(flowLink.getLink(linkId).paid);
    }

    function testRefundGroupReentrancyGuard() public {
        ReenteringContributor attacker = new ReenteringContributor(flowLink);
        vm.deal(address(attacker), 2 ether);
        uint256 linkId = _createGroup();

        attacker.contribute{value: 1 ether}(linkId);
        attacker.setRefundAttack(linkId);

        vm.warp(block.timestamp + 8 days);
        attacker.refund(linkId);

        assertTrue(attacker.sawReentrancy());
        assertEq(flowLink.getGroupContribution(linkId, address(attacker)), 0);
    }

    function testTransferFailureRollbackForPayLink() public {
        RejectETH reject = new RejectETH();

        vm.prank(creator);
        uint256 linkId = flowLink.createPaymentLink(payable(address(reject)), AMOUNT, 0, "Payment", "");

        vm.prank(payer);
        vm.expectRevert(FlowLinkV2.TransferFailed.selector);
        flowLink.payLink{value: AMOUNT}(linkId);

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertFalse(link.paid);
        assertTrue(link.active);
    }

    function testTransferFailureRollbackForGroupFunding() public {
        RejectETH reject = new RejectETH();

        vm.prank(creator);
        uint256 linkId =
            flowLink.createGroupLink(payable(address(reject)), GOAL, block.timestamp + 7 days, "Group", "");

        vm.prank(contributorA);
        vm.expectRevert(FlowLinkV2.TransferFailed.selector);
        flowLink.contributeGroup{value: GOAL}(linkId);

        FlowLinkV2.Link memory link = flowLink.getLink(linkId);
        assertFalse(link.paid);
        assertTrue(link.active);
        assertEq(link.paidAmount, 0);
    }

    function testDirectNativeTransferReverts() public {
        NativeSender sender = new NativeSender();
        vm.deal(address(sender), 1 ether);

        vm.expectRevert();
        sender.sendNative(payable(address(flowLink)), 1 ether);
    }

    function testViews() public {
        uint256 paymentId = _createPayment();
        uint256 groupId = _createGroup();

        uint256[] memory creatorLinks = flowLink.getCreatorLinks(creator);
        assertEq(creatorLinks.length, 2);
        assertEq(creatorLinks[0], paymentId);
        assertEq(creatorLinks[1], groupId);

        vm.prank(payer);
        flowLink.payLink{value: AMOUNT}(paymentId);

        vm.prank(contributorA);
        flowLink.contributeGroup{value: 1 ether}(groupId);

        (
            bool exists,
            bool active,
            bool paid,
            bool expired,
            bool cancelled,
            FlowLinkV2.LinkMode mode,
            uint256 paidAmount,
            uint256 remainingAmount
        ) = flowLink.getLinkStatus(groupId);

        assertTrue(exists);
        assertTrue(active);
        assertFalse(paid);
        assertFalse(expired);
        assertFalse(cancelled);
        assertEq(uint256(mode), uint256(FlowLinkV2.LinkMode.Group));
        assertEq(paidAmount, 1 ether);
        assertEq(remainingAmount, 2 ether);
        assertTrue(flowLink.isPayable(groupId));

        uint256[] memory payerLinks = flowLink.getPayerLinks(payer);
        assertEq(payerLinks.length, 1);
        assertEq(payerLinks[0], paymentId);
    }

    function _createPayment() internal returns (uint256 linkId) {
        vm.prank(creator);
        linkId = flowLink.createPaymentLink(recipient, AMOUNT, 0, "Payment", "Description");
    }

    function _createInvoice(string memory invoiceNumber) internal returns (uint256 linkId) {
        vm.prank(creator);
        linkId = flowLink.createInvoiceLink(
            recipient, AMOUNT, block.timestamp + 30 days, "Acme", invoiceNumber, "Design Sprint", "Invoice work"
        );
    }

    function _createUnlock() internal returns (uint256 linkId) {
        vm.prank(creator);
        linkId = flowLink.createUnlockLink(
            recipient, AMOUNT, 0, "Unlock", "Premium content", "Welcome", "https://example.com/unlock"
        );
    }

    function _createGroup() internal returns (uint256 linkId) {
        vm.prank(creator);
        linkId = flowLink.createGroupLink(recipient, GOAL, block.timestamp + 7 days, "Group", "Group funding");
    }
}

contract RejectETH {
    receive() external payable {
        revert();
    }
}

contract NativeSender {
    function sendNative(address payable target, uint256 amount) external {
        (bool success,) = target.call{value: amount}("");
        require(success);
    }
}

contract ReenteringRecipient {
    enum Attack {
        None,
        Pay,
        Contribute
    }

    FlowLinkV2 internal flowLink;
    Attack internal attack;
    uint256 internal linkId;
    uint256 internal amount;

    bool public sawReentrancy;

    constructor(FlowLinkV2 flowLink_) {
        flowLink = flowLink_;
    }

    function setPayAttack(uint256 linkId_, uint256 amount_) external {
        attack = Attack.Pay;
        linkId = linkId_;
        amount = amount_;
    }

    function setContributeAttack(uint256 linkId_) external {
        attack = Attack.Contribute;
        linkId = linkId_;
    }

    receive() external payable {
        if (attack == Attack.Pay) {
            try flowLink.payLink{value: amount}(linkId) {}
            catch (bytes memory reason) {
                if (bytes4(reason) == FlowLinkV2.Reentrancy.selector) sawReentrancy = true;
            }
        } else if (attack == Attack.Contribute) {
            try flowLink.contributeGroup{value: 1}(linkId) {}
            catch (bytes memory reason) {
                if (bytes4(reason) == FlowLinkV2.Reentrancy.selector) sawReentrancy = true;
            }
        }
    }
}

contract ReenteringContributor {
    FlowLinkV2 internal flowLink;
    uint256 internal attackLinkId;
    bool public sawReentrancy;

    constructor(FlowLinkV2 flowLink_) {
        flowLink = flowLink_;
    }

    function contribute(uint256 linkId) external payable {
        flowLink.contributeGroup{value: msg.value}(linkId);
    }

    function setRefundAttack(uint256 linkId) external {
        attackLinkId = linkId;
    }

    function refund(uint256 linkId) external {
        flowLink.refundGroup(linkId);
    }

    receive() external payable {
        if (attackLinkId != 0) {
            try flowLink.refundGroup(attackLinkId) {}
            catch (bytes memory reason) {
                if (bytes4(reason) == FlowLinkV2.Reentrancy.selector) sawReentrancy = true;
            }
        }
    }
}
