// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FlowLinkV3} from "../contracts/FlowLinkV3.sol";

contract FlowLinkV3Test is Test {
    FlowLinkV3 internal flowLink;

    address internal creator = address(0xA11CE);
    address internal otherCreator = address(0xBEEF);
    address payable internal recipient = payable(address(0xB0B));
    address internal payer = address(0xCAFE);
    address internal contributorA = address(0xAAA1);
    address internal contributorB = address(0xBBB2);

    uint256 internal constant AMOUNT = 1 ether;
    uint256 internal constant GOAL = 3 ether;

    function setUp() public {
        flowLink = new FlowLinkV3();

        vm.deal(payer, 20 ether);
        vm.deal(contributorA, 20 ether);
        vm.deal(contributorB, 20 ether);
    }

    function testCreateProfileByAddressWithoutUsername() public {
        vm.prank(creator);
        flowLink.upsertProfile("", "Alice", "Builder", "");

        FlowLinkV3.Profile memory profile = flowLink.getProfileByAddress(creator);
        assertTrue(profile.exists);
        assertEq(profile.owner, creator);
        assertEq(profile.username, "");
        assertEq(profile.displayName, "Alice");
        assertEq(profile.bio, "Builder");
        assertEq(profile.createdAt, profile.updatedAt);
    }

    function testCreateProfileWithUsernameAndLookups() public {
        vm.prank(creator);
        flowLink.upsertProfile("alice_pay", "Alice", "Arc payments", "https://example.com/a.png");

        FlowLinkV3.Profile memory byAddress = flowLink.getProfileByAddress(creator);
        FlowLinkV3.Profile memory byUsername = flowLink.getProfileByUsername("alice_pay");
        assertEq(byAddress.username, "alice_pay");
        assertEq(byUsername.owner, creator);
        assertEq(flowLink.getAddressByUsername("alice_pay"), creator);
    }

    function testUpdateProfileAndUsernameReleasesOldUsername() public {
        vm.startPrank(creator);
        flowLink.upsertProfile("alice_pay", "Alice", "Old", "");
        vm.warp(block.timestamp + 1);
        flowLink.upsertProfile("alice_2026", "Alice B", "New", "https://example.com/avatar.png");
        vm.stopPrank();

        assertEq(flowLink.getAddressByUsername("alice_pay"), address(0));
        assertEq(flowLink.getAddressByUsername("alice_2026"), creator);

        FlowLinkV3.Profile memory profile = flowLink.getProfileByUsername("alice_2026");
        assertEq(profile.displayName, "Alice B");
        assertEq(profile.bio, "New");
        assertGt(profile.updatedAt, profile.createdAt);

        vm.expectRevert(FlowLinkV3.ProfileNotFound.selector);
        flowLink.getProfileByUsername("alice_pay");
    }

    function testDuplicateAndInvalidUsernameReverts() public {
        vm.prank(creator);
        flowLink.upsertProfile("alice", "Alice", "", "");

        vm.prank(otherCreator);
        vm.expectRevert(FlowLinkV3.UsernameAlreadyTaken.selector);
        flowLink.upsertProfile("alice", "Other", "", "");

        vm.prank(otherCreator);
        vm.expectRevert(FlowLinkV3.InvalidUsername.selector);
        flowLink.upsertProfile("BadName", "Other", "", "");

        vm.prank(otherCreator);
        vm.expectRevert(FlowLinkV3.InvalidUsername.selector);
        flowLink.upsertProfile("ab", "Other", "", "");
    }

    function testEmptyUsernameProfileWorks() public {
        vm.prank(creator);
        flowLink.upsertProfile("", "", "", "");

        FlowLinkV3.Profile memory profile = flowLink.getProfileByAddress(creator);
        assertTrue(profile.exists);
        assertEq(profile.username, "");
    }

    function testCreateLinkWithUniqueSlugAndResolve() public {
        uint256 linkId = _createPayment("pay_k82mP9aQ", true);

        assertEq(flowLink.getLinkIdBySlug("pay_k82mP9aQ"), linkId);
        FlowLinkV3.Link memory link = flowLink.getLinkBySlug("pay_k82mP9aQ");
        assertEq(link.slug, "pay_k82mP9aQ");
        assertTrue(link.listed);
    }

    function testDuplicateAndInvalidSlugReverts() public {
        _createPayment("pay_unique_1", true);

        vm.prank(creator);
        vm.expectRevert(FlowLinkV3.SlugAlreadyTaken.selector);
        flowLink.createPaymentLink(recipient, AMOUNT, 0, "Payment", "", "pay_unique_1", true);

        vm.prank(creator);
        vm.expectRevert(FlowLinkV3.InvalidSlug.selector);
        flowLink.createPaymentLink(recipient, AMOUNT, 0, "Payment", "", "abc", true);

        vm.prank(creator);
        vm.expectRevert(FlowLinkV3.InvalidSlug.selector);
        flowLink.createPaymentLink(recipient, AMOUNT, 0, "Payment", "", "bad.slug", true);

        vm.prank(creator);
        vm.expectRevert(FlowLinkV3.InvalidSlug.selector);
        flowLink.createPaymentLink(
            recipient,
            AMOUNT,
            0,
            "Payment",
            "",
            "pay_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_too_long",
            true
        );
    }

    function testSlugBasedPayGroupContributionAndCancel() public {
        uint256 paymentId = _createPayment("pay_by_slug", true);
        vm.prank(payer);
        flowLink.payLinkBySlug{value: AMOUNT}("pay_by_slug");
        assertTrue(flowLink.getLink(paymentId).paid);

        uint256 groupId = _createGroup("group_slug_pay", true);
        vm.prank(contributorA);
        flowLink.contributeGroupBySlug{value: 1 ether}("group_slug_pay");
        assertEq(flowLink.getGroupContribution(groupId, contributorA), 1 ether);

        uint256 cancelId = _createPayment("pay_cancel_by_slug", true);
        vm.prank(creator);
        flowLink.cancelLinkBySlug("pay_cancel_by_slug");
        assertFalse(flowLink.getLink(cancelId).active);

        vm.expectRevert(FlowLinkV3.InvalidLink.selector);
        flowLink.getLinkBySlug("missing_slug");
    }

    function testListedAndUnlistedLinks() public {
        uint256 listedId = _createPayment("pay_listed", true);
        uint256 unlistedId = _createPayment("pay_unlisted", false);

        uint256[] memory creatorLinks = flowLink.getCreatorLinks(creator);
        assertEq(creatorLinks.length, 2);
        assertEq(creatorLinks[0], listedId);
        assertEq(creatorLinks[1], unlistedId);

        uint256[] memory listedLinks = flowLink.getListedCreatorLinks(creator);
        assertEq(listedLinks.length, 1);
        assertEq(listedLinks[0], listedId);

        vm.prank(creator);
        flowLink.cancelLink(listedId);
        assertEq(flowLink.getListedCreatorLinks(creator)[0], listedId);
        (, bool active,, bool expired, bool cancelled,,,) = flowLink.getLinkStatus(listedId);
        assertFalse(active);
        assertFalse(expired);
        assertTrue(cancelled);
    }

    function testCreatePaymentLinkAndPayExactAmount() public {
        uint256 linkId = _createPayment("pay_exact", true);
        uint256 beforeBalance = recipient.balance;

        vm.prank(payer);
        flowLink.payLink{value: AMOUNT}(linkId);

        FlowLinkV3.Link memory link = flowLink.getLink(linkId);
        assertEq(uint256(link.mode), uint256(FlowLinkV3.LinkMode.Payment));
        assertTrue(link.paid);
        assertFalse(link.active);
        assertEq(link.payer, payer);
        assertEq(link.paidAmount, AMOUNT);
        assertEq(recipient.balance - beforeBalance, AMOUNT);
        assertTrue(link.receiptId != bytes32(0));
    }

    function testWrongAmountCancelAndDeadlineBehavior() public {
        uint256 wrongAmountId = _createPayment("pay_wrong", true);
        vm.prank(payer);
        vm.expectRevert(FlowLinkV3.WrongPaymentAmount.selector);
        flowLink.payLink{value: AMOUNT - 1}(wrongAmountId);

        uint256 cancelId = _createPayment("pay_cancel", true);
        vm.prank(creator);
        flowLink.cancelLink(cancelId);

        vm.prank(payer);
        vm.expectRevert(FlowLinkV3.LinkInactive.selector);
        flowLink.payLink{value: AMOUNT}(cancelId);

        uint256 paidId = _createPayment("pay_paid_cancel", true);
        vm.prank(payer);
        flowLink.payLink{value: AMOUNT}(paidId);

        vm.prank(creator);
        vm.expectRevert(FlowLinkV3.LinkAlreadyPaid.selector);
        flowLink.cancelLink(paidId);

        vm.prank(creator);
        uint256 expiredId =
            flowLink.createPaymentLink(recipient, AMOUNT, block.timestamp + 1 days, "Payment", "", "pay_expire", true);
        vm.warp(block.timestamp + 2 days);

        vm.prank(payer);
        vm.expectRevert(FlowLinkV3.LinkExpired.selector);
        flowLink.payLink{value: AMOUNT}(expiredId);
    }

    function testInvoiceTitlesAndPayment() public {
        uint256 invoiceId = _createInvoice("inv_design_2026", "INV-100");
        FlowLinkV3.Link memory invoice = flowLink.getLink(invoiceId);
        assertEq(invoice.clientName, "Acme");
        assertEq(invoice.invoiceNumber, "INV-100");
        assertEq(invoice.serviceTitle, "Design Sprint");
        assertEq(invoice.title, unicode"Invoice #INV-100 — Design Sprint");

        uint256 noNumberId = _createInvoice("inv_design_no_number", "");
        assertEq(flowLink.getLink(noNumberId).title, unicode"Invoice — Design Sprint");

        vm.prank(payer);
        flowLink.payLink{value: AMOUNT}(invoiceId);
        assertTrue(flowLink.getLink(invoiceId).paid);
    }

    function testUnlockStoresMetadataAndPayWorks() public {
        uint256 linkId = _createUnlock("unlock_8Gq2mPz91a");

        FlowLinkV3.Link memory beforePay = flowLink.getLink(linkId);
        assertEq(uint256(beforePay.mode), uint256(FlowLinkV3.LinkMode.Unlock));
        assertEq(beforePay.successMessage, "Welcome");
        assertEq(beforePay.unlockUrl, "https://example.com/unlock");

        vm.prank(payer);
        flowLink.payLink{value: AMOUNT}(linkId);

        FlowLinkV3.Link memory afterPay = flowLink.getLink(linkId);
        assertTrue(afterPay.paid);
        assertEq(afterPay.successMessage, "Welcome");
        assertEq(afterPay.unlockUrl, "https://example.com/unlock");
    }

    function testGroupLifecycle() public {
        vm.startPrank(creator);
        vm.expectRevert(FlowLinkV3.InvalidDeadline.selector);
        flowLink.createGroupLink(recipient, GOAL, 0, "Group", "", "group_bad_deadline", true);
        vm.stopPrank();

        uint256 linkId = _createGroup("group_ai_tools_fund", true);
        FlowLinkV3.Link memory created = flowLink.getLink(linkId);
        assertEq(uint256(created.mode), uint256(FlowLinkV3.LinkMode.Group));
        assertEq(created.amount, GOAL);
        assertEq(created.paidAmount, 0);

        vm.prank(contributorA);
        flowLink.contributeGroup{value: 1 ether}(linkId);
        vm.prank(contributorB);
        flowLink.contributeGroup{value: 1 ether}(linkId);

        assertEq(flowLink.getGroupContribution(linkId, contributorA), 1 ether);
        assertEq(flowLink.getGroupContribution(linkId, contributorB), 1 ether);
        assertEq(flowLink.getGroupContributors(linkId).length, 2);
        assertEq(flowLink.getLink(linkId).paidAmount, 2 ether);

        vm.prank(contributorA);
        vm.expectRevert(FlowLinkV3.InvalidAmount.selector);
        flowLink.contributeGroup{value: 2 ether}(linkId);

        uint256 beforeBalance = recipient.balance;
        vm.prank(contributorB);
        flowLink.contributeGroup{value: 1 ether}(linkId);

        FlowLinkV3.Link memory funded = flowLink.getLink(linkId);
        assertTrue(funded.paid);
        assertFalse(funded.active);
        assertEq(funded.payer, contributorB);
        assertEq(recipient.balance - beforeBalance, GOAL);

        vm.prank(contributorA);
        vm.expectRevert(FlowLinkV3.GroupAlreadyFunded.selector);
        flowLink.contributeGroup{value: 1}(linkId);

        vm.prank(creator);
        vm.expectRevert(FlowLinkV3.CannotCancelFundedGroup.selector);
        flowLink.cancelLink(linkId);
    }

    function testGroupRefundsAfterDeadlineAndCancel() public {
        uint256 expiredId = _createGroup("group_refund_expire", true);
        vm.prank(contributorA);
        flowLink.contributeGroup{value: 1 ether}(expiredId);

        vm.prank(contributorA);
        vm.expectRevert(FlowLinkV3.GroupNotExpired.selector);
        flowLink.refundGroup(expiredId);

        vm.warp(block.timestamp + 8 days);
        uint256 beforeBalance = contributorA.balance;
        vm.prank(contributorA);
        flowLink.refundGroup(expiredId);
        assertEq(contributorA.balance - beforeBalance, 1 ether);
        assertEq(flowLink.getGroupContribution(expiredId, contributorA), 0);

        uint256 cancelId = _createGroup("group_refund_cancel", true);
        vm.prank(contributorB);
        flowLink.contributeGroup{value: 1 ether}(cancelId);

        vm.prank(creator);
        flowLink.cancelLink(cancelId);

        beforeBalance = contributorB.balance;
        vm.prank(contributorB);
        flowLink.refundGroupBySlug("group_refund_cancel");
        assertEq(contributorB.balance - beforeBalance, 1 ether);

        vm.prank(contributorA);
        vm.expectRevert(FlowLinkV3.NoContribution.selector);
        flowLink.refundGroup(cancelId);
    }

    function testSecurityTransferFailuresReentrancyAndDirectTransfer() public {
        RejectETH reject = new RejectETH();

        vm.prank(creator);
        uint256 payId = flowLink.createPaymentLink(payable(address(reject)), AMOUNT, 0, "Payment", "", "pay_reject", true);
        vm.prank(payer);
        vm.expectRevert(FlowLinkV3.TransferFailed.selector);
        flowLink.payLink{value: AMOUNT}(payId);
        assertFalse(flowLink.getLink(payId).paid);
        assertTrue(flowLink.getLink(payId).active);

        vm.prank(creator);
        uint256 groupId =
            flowLink.createGroupLink(payable(address(reject)), GOAL, block.timestamp + 7 days, "Group", "", "group_reject", true);
        vm.prank(contributorA);
        vm.expectRevert(FlowLinkV3.TransferFailed.selector);
        flowLink.contributeGroup{value: GOAL}(groupId);
        assertFalse(flowLink.getLink(groupId).paid);
        assertEq(flowLink.getLink(groupId).paidAmount, 0);

        NativeSender sender = new NativeSender();
        vm.deal(address(sender), 1 ether);
        vm.expectRevert();
        sender.sendNative(payable(address(flowLink)), 1 ether);
    }

    function testReentrancyGuards() public {
        ReenteringRecipient attacker = new ReenteringRecipient(flowLink);
        vm.deal(address(attacker), AMOUNT);

        vm.prank(creator);
        uint256 payId =
            flowLink.createPaymentLink(payable(address(attacker)), AMOUNT, 0, "Payment", "", "pay_reenter", true);
        attacker.setPayAttack(payId, AMOUNT);

        vm.prank(payer);
        flowLink.payLink{value: AMOUNT}(payId);
        assertTrue(attacker.sawReentrancy());

        ReenteringRecipient groupAttacker = new ReenteringRecipient(flowLink);
        vm.prank(creator);
        uint256 groupId = flowLink.createGroupLink(
            payable(address(groupAttacker)), GOAL, block.timestamp + 7 days, "Group", "", "group_reenter", true
        );
        groupAttacker.setContributeAttack(groupId);

        vm.prank(contributorA);
        flowLink.contributeGroup{value: GOAL}(groupId);
        assertTrue(groupAttacker.sawReentrancy());

        ReenteringContributor refundAttacker = new ReenteringContributor(flowLink);
        vm.deal(address(refundAttacker), 2 ether);
        uint256 refundId = _createGroup("group_refund_reenter", true);
        refundAttacker.contribute{value: 1 ether}(refundId);
        refundAttacker.setRefundAttack(refundId);

        vm.warp(block.timestamp + 8 days);
        refundAttacker.refund(refundId);
        assertTrue(refundAttacker.sawReentrancy());
        assertEq(flowLink.getGroupContribution(refundId, address(refundAttacker)), 0);
    }

    function testViews() public {
        uint256 paymentId = _createPayment("pay_views", true);
        uint256 groupId = _createGroup("group_views", true);

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
            FlowLinkV3.LinkMode mode,
            uint256 paidAmount,
            uint256 remainingAmount
        ) = flowLink.getLinkStatusBySlug("group_views");

        assertTrue(exists);
        assertTrue(active);
        assertFalse(paid);
        assertFalse(expired);
        assertFalse(cancelled);
        assertEq(uint256(mode), uint256(FlowLinkV3.LinkMode.Group));
        assertEq(paidAmount, 1 ether);
        assertEq(remainingAmount, 2 ether);
        assertTrue(flowLink.isPayable(groupId));
        assertTrue(flowLink.isPayableBySlug("group_views"));

        uint256[] memory payerLinks = flowLink.getPayerLinks(payer);
        assertEq(payerLinks.length, 1);
        assertEq(payerLinks[0], paymentId);
    }

    function _createPayment(string memory slug, bool listed) internal returns (uint256 linkId) {
        vm.prank(creator);
        linkId = flowLink.createPaymentLink(recipient, AMOUNT, 0, "Payment", "Description", slug, listed);
    }

    function _createInvoice(string memory slug, string memory invoiceNumber) internal returns (uint256 linkId) {
        vm.prank(creator);
        linkId = flowLink.createInvoiceLink(
            recipient,
            AMOUNT,
            block.timestamp + 30 days,
            "Acme",
            invoiceNumber,
            "Design Sprint",
            "Invoice work",
            slug,
            true
        );
    }

    function _createUnlock(string memory slug) internal returns (uint256 linkId) {
        vm.prank(creator);
        linkId = flowLink.createUnlockLink(
            recipient, AMOUNT, 0, "Unlock", "Premium content", "Welcome", "https://example.com/unlock", slug, true
        );
    }

    function _createGroup(string memory slug, bool listed) internal returns (uint256 linkId) {
        vm.prank(creator);
        linkId = flowLink.createGroupLink(recipient, GOAL, block.timestamp + 7 days, "Group", "Group funding", slug, listed);
    }
}

contract RejectETH {
    receive() external payable {
        revert();
    }
}

contract NativeSender {
    error SendFailed();

    function sendNative(address payable target, uint256 amount) external {
        (bool success,) = target.call{value: amount}("");
        if (!success) revert SendFailed();
    }
}

contract ReenteringRecipient {
    enum Attack {
        None,
        Pay,
        Contribute
    }

    FlowLinkV3 internal flowLink;
    Attack internal attack;
    uint256 internal linkId;
    uint256 internal amount;

    bool public sawReentrancy;

    constructor(FlowLinkV3 flowLink_) {
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
                if (bytes4(reason) == FlowLinkV3.Reentrancy.selector) sawReentrancy = true;
            }
        } else if (attack == Attack.Contribute) {
            try flowLink.contributeGroup{value: 1}(linkId) {}
            catch (bytes memory reason) {
                if (bytes4(reason) == FlowLinkV3.Reentrancy.selector) sawReentrancy = true;
            }
        }
    }
}

contract ReenteringContributor {
    FlowLinkV3 internal flowLink;
    uint256 internal attackLinkId;
    bool public sawReentrancy;

    constructor(FlowLinkV3 flowLink_) {
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
                if (bytes4(reason) == FlowLinkV3.Reentrancy.selector) sawReentrancy = true;
            }
        }
    }
}
