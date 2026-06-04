// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FlowLink} from "../contracts/FlowLink.sol";

contract RejectETH {
    error RejectsNative();

    receive() external payable {
        revert RejectsNative();
    }
}

contract ReenteringRecipient {
    FlowLink private immutable flowLink;

    uint256 private linkId;
    bool public attempted;
    bytes public revertData;

    constructor(FlowLink flowLink_) {
        flowLink = flowLink_;
    }

    function setLinkId(uint256 linkId_) external {
        linkId = linkId_;
    }

    receive() external payable {
        if (attempted) return;

        attempted = true;

        try flowLink.payLink{value: msg.value}(linkId) {}
        catch (bytes memory data) {
            revertData = data;
        }
    }
}

contract NativeSender {
    function sendNative(address target) external payable {
        (bool success, bytes memory revertData) = target.call{value: msg.value}("");
        if (!success) {
            assembly {
                revert(add(revertData, 32), mload(revertData))
            }
        }
    }
}

contract FlowLinkTest is Test {
    FlowLink private flowLink;

    address private creator = address(0xA11CE);
    address private payer = address(0xB0B);
    address payable private recipient = payable(address(0xCAFE));

    uint256 private amount = 25 ether;

    function setUp() public {
        flowLink = new FlowLink();
        vm.deal(payer, 1_000 ether);
    }

    function testCreateLinkStoresAllDataCorrectly() public {
        uint256 deadline = block.timestamp + 1 days;

        vm.prank(creator);
        uint256 linkId = flowLink.createLink(recipient, amount, deadline, "Invoice 1001", "Arc USDC payment");

        FlowLink.PaymentLink memory link = flowLink.getLink(linkId);
        assertEq(linkId, 1);
        assertEq(flowLink.nextLinkId(), 2);
        assertEq(link.creator, creator);
        assertEq(link.recipient, recipient);
        assertEq(link.amount, amount);
        assertEq(link.deadline, deadline);
        assertEq(link.title, "Invoice 1001");
        assertEq(link.description, "Arc USDC payment");
        assertTrue(link.active);
        assertFalse(link.paid);
        assertEq(link.payer, address(0));
        assertEq(link.paidAt, 0);
        assertEq(link.receiptId, bytes32(0));
        assertEq(link.createdAt, block.timestamp);
        assertEq(link.cancelledAt, 0);
    }

    function testCreateLinkRevertsOnZeroRecipient() public {
        vm.expectRevert(FlowLink.InvalidRecipient.selector);
        flowLink.createLink(payable(address(0)), amount, 0, "Invoice", "");
    }

    function testCreateLinkRevertsOnZeroAmount() public {
        vm.expectRevert(FlowLink.InvalidAmount.selector);
        flowLink.createLink(recipient, 0, 0, "Invoice", "");
    }

    function testCreateLinkRevertsOnPastDeadline() public {
        vm.warp(100);

        vm.expectRevert(FlowLink.InvalidDeadline.selector);
        flowLink.createLink(recipient, amount, 99, "Invoice", "");
    }

    function testCreateLinkRevertsOnEmptyTitle() public {
        vm.expectRevert(FlowLink.InvalidLink.selector);
        flowLink.createLink(recipient, amount, 0, "", "");
    }

    function testCreateLinkAllowsDeadlineEqualToCurrentTimestampPlusOne() public {
        vm.warp(100);

        vm.prank(creator);
        uint256 linkId = flowLink.createLink(recipient, amount, block.timestamp + 1, "Invoice", "");

        FlowLink.PaymentLink memory link = flowLink.getLink(linkId);
        assertEq(link.deadline, 101);
    }

    function testPayLinkSucceedsWithExactAmount() public {
        uint256 linkId = _createLink();

        vm.prank(payer);
        flowLink.payLink{value: amount}(linkId);

        FlowLink.PaymentLink memory link = flowLink.getLink(linkId);
        assertTrue(link.paid);
    }

    function testPayLinkForwardsFundsToRecipient() public {
        uint256 linkId = _createLink();
        uint256 beforeBalance = recipient.balance;

        vm.prank(payer);
        flowLink.payLink{value: amount}(linkId);

        assertEq(recipient.balance, beforeBalance + amount);
        assertEq(address(flowLink).balance, 0);
    }

    function testPayLinkStoresPayerPaidAtReceiptId() public {
        uint256 linkId = _createLink();
        uint256 paidAt = block.timestamp + 10;
        vm.warp(paidAt);

        vm.prank(payer);
        flowLink.payLink{value: amount}(linkId);

        FlowLink.PaymentLink memory link = flowLink.getLink(linkId);
        bytes32 expectedReceiptId =
            keccak256(abi.encodePacked(address(flowLink), block.chainid, linkId, payer, recipient, amount, paidAt));

        assertEq(link.payer, payer);
        assertEq(link.paidAt, paidAt);
        assertEq(link.receiptId, expectedReceiptId);
    }

    function testPayLinkMarksActiveFalseAndPaidTrue() public {
        uint256 linkId = _createLink();

        vm.prank(payer);
        flowLink.payLink{value: amount}(linkId);

        FlowLink.PaymentLink memory link = flowLink.getLink(linkId);
        assertFalse(link.active);
        assertTrue(link.paid);
    }

    function testPayLinkAddsLinkIdToLinksByPayer() public {
        uint256 linkId = _createLink();

        vm.prank(payer);
        flowLink.payLink{value: amount}(linkId);

        uint256[] memory payerLinks = flowLink.getPayerLinks(payer);
        assertEq(payerLinks.length, 1);
        assertEq(payerLinks[0], linkId);
    }

    function testPayLinkRevertsWithWrongAmount() public {
        uint256 linkId = _createLink();

        vm.prank(payer);
        vm.expectRevert(FlowLink.WrongPaymentAmount.selector);
        flowLink.payLink{value: amount - 1}(linkId);
    }

    function testPayLinkRevertsIfExpired() public {
        uint256 deadline = block.timestamp + 1 days;

        vm.prank(creator);
        uint256 linkId = flowLink.createLink(recipient, amount, deadline, "Invoice", "");

        vm.warp(deadline + 1);

        vm.prank(payer);
        vm.expectRevert(FlowLink.LinkExpired.selector);
        flowLink.payLink{value: amount}(linkId);
    }

    function testPayLinkSucceedsAtExactDeadline() public {
        uint256 deadline = block.timestamp + 1 days;

        vm.prank(creator);
        uint256 linkId = flowLink.createLink(recipient, amount, deadline, "Invoice", "");

        vm.warp(deadline);

        vm.prank(payer);
        flowLink.payLink{value: amount}(linkId);

        FlowLink.PaymentLink memory link = flowLink.getLink(linkId);
        assertTrue(link.paid);
    }

    function testPayLinkRevertsIfAlreadyPaid() public {
        uint256 linkId = _createAndPayLink();

        vm.deal(address(0xDAD), amount);
        vm.prank(address(0xDAD));
        vm.expectRevert(FlowLink.LinkAlreadyPaid.selector);
        flowLink.payLink{value: amount}(linkId);
    }

    function testPayLinkRevertsIfInactiveCancelled() public {
        uint256 linkId = _createLink();

        vm.prank(creator);
        flowLink.cancelLink(linkId);

        vm.prank(payer);
        vm.expectRevert(FlowLink.LinkInactive.selector);
        flowLink.payLink{value: amount}(linkId);
    }

    function testCancelLinkSucceedsByCreator() public {
        uint256 linkId = _createLink();

        vm.prank(creator);
        flowLink.cancelLink(linkId);

        FlowLink.PaymentLink memory link = flowLink.getLink(linkId);
        assertFalse(link.active);
        assertFalse(link.paid);
        assertEq(link.cancelledAt, block.timestamp);
    }

    function testCancelLinkRevertsIfCallerIsNotCreator() public {
        uint256 linkId = _createLink();

        vm.prank(payer);
        vm.expectRevert(FlowLink.NotCreator.selector);
        flowLink.cancelLink(linkId);
    }

    function testCancelLinkRevertsIfAlreadyPaid() public {
        uint256 linkId = _createAndPayLink();

        vm.prank(creator);
        vm.expectRevert(FlowLink.LinkAlreadyPaid.selector);
        flowLink.cancelLink(linkId);
    }

    function testGetCreatorLinksReturnsExpectedIds() public {
        vm.startPrank(creator);
        uint256 first = flowLink.createLink(recipient, amount, 0, "First", "");
        uint256 second = flowLink.createLink(recipient, amount * 2, 0, "Second", "");
        vm.stopPrank();

        uint256[] memory creatorLinks = flowLink.getCreatorLinks(creator);
        assertEq(creatorLinks.length, 2);
        assertEq(creatorLinks[0], first);
        assertEq(creatorLinks[1], second);
    }

    function testGetPayerLinksReturnsExpectedIds() public {
        uint256 first = _createLink();
        uint256 second = _createLink();

        vm.startPrank(payer);
        flowLink.payLink{value: amount}(first);
        flowLink.payLink{value: amount}(second);
        vm.stopPrank();

        uint256[] memory payerLinks = flowLink.getPayerLinks(payer);
        assertEq(payerLinks.length, 2);
        assertEq(payerLinks[0], first);
        assertEq(payerLinks[1], second);
    }

    function testDirectNativeTransferToContractReverts() public {
        NativeSender sender = new NativeSender();
        vm.deal(address(sender), amount);

        vm.expectRevert(FlowLink.InvalidLink.selector);
        sender.sendNative{value: amount}(address(flowLink));
    }

    function testMaliciousRecipientTransferFailureRevertsAndPaymentIsRolledBack() public {
        RejectETH rejectingRecipient = new RejectETH();

        vm.prank(creator);
        uint256 linkId = flowLink.createLink(payable(address(rejectingRecipient)), amount, 0, "Invoice", "");

        vm.prank(payer);
        vm.expectRevert(FlowLink.TransferFailed.selector);
        flowLink.payLink{value: amount}(linkId);

        FlowLink.PaymentLink memory link = flowLink.getLink(linkId);
        assertFalse(link.paid);
        assertTrue(link.active);
        assertEq(link.payer, address(0));
        assertEq(link.paidAt, 0);
        assertEq(link.receiptId, bytes32(0));
    }

    function testRecipientCannotReenterPayLink() public {
        ReenteringRecipient reenteringRecipient = new ReenteringRecipient(flowLink);

        vm.prank(creator);
        uint256 linkId = flowLink.createLink(payable(address(reenteringRecipient)), amount, 0, "Invoice", "");
        reenteringRecipient.setLinkId(linkId);

        vm.prank(payer);
        flowLink.payLink{value: amount}(linkId);

        FlowLink.PaymentLink memory link = flowLink.getLink(linkId);
        assertTrue(link.paid);
        assertTrue(reenteringRecipient.attempted());
        assertEq(bytes4(reenteringRecipient.revertData()), FlowLink.Reentrancy.selector);
        assertEq(address(reenteringRecipient).balance, amount);
    }

    function testInvalidLinkIdsRevertOrReturnSafeStatus() public {
        vm.expectRevert(FlowLink.InvalidLink.selector);
        flowLink.getLink(0);

        vm.expectRevert(FlowLink.InvalidLink.selector);
        flowLink.payLink{value: amount}(999);

        vm.prank(creator);
        vm.expectRevert(FlowLink.InvalidLink.selector);
        flowLink.cancelLink(999);

        (bool exists, bool active, bool paid, bool expired, bool cancelled) = flowLink.getLinkStatus(999);
        assertFalse(exists);
        assertFalse(active);
        assertFalse(paid);
        assertFalse(expired);
        assertFalse(cancelled);
        assertFalse(flowLink.isPayable(999));
    }

    function testGetLinkStatusAndIsPayable() public {
        uint256 deadline = block.timestamp + 1 days;

        vm.prank(creator);
        uint256 linkId = flowLink.createLink(recipient, amount, deadline, "Invoice", "");

        (bool exists, bool active, bool paid, bool expired, bool cancelled) = flowLink.getLinkStatus(linkId);
        assertTrue(exists);
        assertTrue(active);
        assertFalse(paid);
        assertFalse(expired);
        assertFalse(cancelled);
        assertTrue(flowLink.isPayable(linkId));

        vm.warp(deadline + 1);

        (, active, paid, expired, cancelled) = flowLink.getLinkStatus(linkId);
        assertTrue(active);
        assertFalse(paid);
        assertTrue(expired);
        assertFalse(cancelled);
        assertFalse(flowLink.isPayable(linkId));
    }

    function _createLink() private returns (uint256 linkId) {
        vm.prank(creator);
        linkId = flowLink.createLink(recipient, amount, 0, "Invoice", "Payment for services");
    }

    function _createAndPayLink() private returns (uint256 linkId) {
        linkId = _createLink();

        vm.prank(payer);
        flowLink.payLink{value: amount}(linkId);
    }
}
