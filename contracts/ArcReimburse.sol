// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract ArcReimburse {
    struct Deal { address buyer; address seller; string desc; uint256 amount; uint8 status; uint256 at; }
    Deal[] public deals;
    mapping(address => uint256[]) private buyerMap;
    mapping(address => uint256[]) private sellerMap;
    event Created(uint256 indexed id, address indexed buyer, address indexed seller, uint256 amount);
    function create(address seller, string calldata desc) external payable returns (uint256 id) {
        require(msg.value > 0 && seller != address(0), "bad");
        id = deals.length;
        deals.push(Deal(msg.sender, seller, desc, msg.value, 0, block.timestamp));
        buyerMap[msg.sender].push(id); sellerMap[seller].push(id);
        emit Created(id, msg.sender, seller, msg.value);
    }
    function release(uint256 id) external {
        Deal storage d = deals[id]; require(msg.sender == d.buyer && d.status == 0, "no");
        d.status = 1; (bool ok,) = payable(d.seller).call{value: d.amount}(""); require(ok, "fail");
    }
    function refund(uint256 id) external {
        Deal storage d = deals[id]; require(msg.sender == d.seller && d.status == 0, "no");
        d.status = 2; (bool ok,) = payable(d.buyer).call{value: d.amount}(""); require(ok, "fail");
    }
    function get(uint256 id) external view returns (Deal memory) { return deals[id]; }
    function getBuyer(address u) external view returns (uint256[] memory) { return buyerMap[u]; }
    function getSeller(address u) external view returns (uint256[] memory) { return sellerMap[u]; }
    function total() external view returns (uint256) { return deals.length; }
}
