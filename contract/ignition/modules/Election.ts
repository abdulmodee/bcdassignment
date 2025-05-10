import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const VotingSystemModule = buildModule("VotingSystemModule", (m) => {
    // Deploy the factory first
    const factory = m.contract("ElectionFactory", []);
    
    // If you want to create an initial election right away:
    const now = Math.floor(Date.now() / 1000);
    const oneDay = 24 * 60 * 60;
    
    m.call(factory, "createElection", [
        "First Election",
        ["Proposal A", "Proposal B", "Proposal C"],
        ["0x8A224DEbA686a42F4CB856390f34Baee6962F6bF"], // allowed voters
        now,
        now + oneDay
    ]);
    
    return { factory };
});

export default VotingSystemModule;