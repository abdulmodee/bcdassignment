'use client';
import React, { useState, useEffect } from 'react';
import { BrowserProvider, ethers, Contract } from 'ethers';
import FactoryABI from '../../ABI/ElectionFactoryABI.json';

// Update with your factory address
const FACTORY_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';

export default function CreateElectionPage() {
    // Form state
    const [title, setTitle] = useState<string>('');
    const [proposals, setProposals] = useState<string>('');
    const [voters, setVoters] = useState<string>('');
    const [durationHours, setDurationHours] = useState<number>(24);

    // Blockchain state
    const [provider, setProvider] = useState<BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [factoryContract, setFactoryContract] = useState<Contract | null>(null);
    const [account, setAccount] = useState<string>('');

    // UI state
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [debug, setDebug] = useState<string>('');

    // Debug eligibility inputs
    const [debugElectionAddress, setDebugElectionAddress] = useState<string>('');
    const [debugProposalName, setDebugProposalName] = useState<string>('');

    // Initialize provider
    useEffect(() => {
        const initProvider = async () => {
            if (window.ethereum) {
                try {
                    const provider = new BrowserProvider(window.ethereum);
                    setProvider(provider);

                    await provider.send('eth_requestAccounts', []);
                    const signer = await provider.getSigner();
                    setSigner(signer);

                    const address = await signer.getAddress();
                    setAccount(address);

                    // Initialize factory contract
                    const factory = new ethers.Contract(FACTORY_ADDRESS, FactoryABI.abi, signer);
                    setFactoryContract(factory);

                    setStatus('Connected to wallet');
                } catch (err: any) {
                    console.error("Connection error:", err);
                    setStatus(`Connection error: ${err.message}`);
                }
            } else {
                setStatus('Please install MetaMask');
            }
        };

        initProvider();
    }, []);

    // Add the debug function to check vote eligibility
    const checkVoteEligibility = async (electionAddress: string, proposalName: string) => {
        if (!signer) {
            setDebug("Error: Wallet not connected");
            return;
        }

        try {
            // Import ElectionABI
            const ElectionABI = (await import('../../ABI/ElectionABI.json')).default;

            // Create contract instance
            const electionContract = new ethers.Contract(electionAddress, ElectionABI.abi, signer);

            // Check if user is a registered voter
            const isRegistered = await electionContract.voterRegistry(account);
            let debugInfo = `Is registered voter: ${isRegistered}\n`;

            // Check if user has already voted
            const hasVoted = await electionContract.hasVoted(account);
            debugInfo += `Has already voted: ${hasVoted}\n`;

            // Check if proposal exists
            try {
                const votes = await electionContract.getProposalVotes(proposalName);
                debugInfo += `Proposal exists, current votes: ${votes.toString()}\n`;
            } catch (err: any) {
                debugInfo += `Proposal might not exist: ${err.message}\n`;
            }

            // Check voting period
            const startTime = await electionContract.startTime();
            const endTime = await electionContract.endTime();
            const ended = await electionContract.ended();
            const currentTime = Math.floor(Date.now() / 1000);

            debugInfo += `Start time: ${new Date(Number(startTime) * 1000).toLocaleString()}\n`;
            debugInfo += `End time: ${new Date(Number(endTime) * 1000).toLocaleString()}\n`;
            debugInfo += `Current time: ${new Date(currentTime * 1000).toLocaleString()}\n`;
            debugInfo += `Election ended: ${ended}\n`;
            debugInfo += `Is active: ${currentTime >= Number(startTime) && currentTime <= Number(endTime) && !ended}\n`;

            // Check the exact status code
            const status = await electionContract.canVote(proposalName);
            debugInfo += `Vote status code: ${status.toString()}\n`;

            switch (Number(status)) {
                case 0: debugInfo += `Status: Can vote`; break;
                case 1: debugInfo += `Status: Not registered to vote`; break;
                case 2: debugInfo += `Status: Already voted`; break;
                case 3: debugInfo += `Status: Invalid proposal`; break;
                default: debugInfo += `Status: Unknown`;
            }

            setDebug(debugInfo);
        } catch (err: any) {
            setDebug(`Error checking vote eligibility: ${err.message}`);
        }
    };

    // Handle form submission
    const handleCreateElection = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!factoryContract) {
            setStatus('Contract not initialized');
            return;
        }

        if (!title || !proposals || !voters) {
            setStatus('Please fill all required fields');
            return;
        }

        setLoading(true);
        setStatus('Creating election...');

        try {
            const proposalArray = proposals.split(',').map(p => p.trim());
            const voterArray = voters.split(',').map(v => v.trim());

            // Calculate timestamps
            const now = Math.floor(Date.now() / 1000);
            const endTime = now + (durationHours * 60 * 60);

            // Create transaction
            const tx = await factoryContract.createElection(
                title,
                proposalArray,
                voterArray,
                now,
                endTime
            );

            setStatus(`Transaction submitted: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();

            // Get the new election address from events
            let electionAddress = '';

            // Try to find event from logs
            try {
                const eventTopic = ethers.id('ElectionCreated(address,string,uint256,uint256)');
                const event = receipt.logs.find((log: any) =>
                    log.topics[0] === eventTopic
                );

                if (event && factoryContract) {
                    const parsedLog = factoryContract.interface.parseLog({
                        topics: event.topics as string[],
                        data: event.data
                    });

                    if (parsedLog && parsedLog.args) {
                        electionAddress = parsedLog.args[0];
                    }
                }
            } catch (err) {
                console.error("Error parsing event:", err);
            }

            // Fallback: get latest election
            if (!electionAddress && factoryContract) {
                try {
                    const count = await factoryContract.getElectionCount();
                    const details = await factoryContract.getElectionDetails(count - 1);
                    electionAddress = details.electionAddress;
                } catch (err) {
                    console.error("Error getting election details:", err);
                }
            }

            if (electionAddress) {
                setStatus(`Election created successfully at address ${electionAddress}`);
                // Auto-fill the debug address field with the new election
                setDebugElectionAddress(electionAddress);

                // If proposals were entered, fill the first one for debugging
                if (proposalArray.length > 0) {
                    setDebugProposalName(proposalArray[0]);
                }
            } else {
                setStatus('Election created but address not captured');
            }

            // Reset form
            setTitle('');
            setProposals('');
            setVoters('');
            setDurationHours(24);
        } catch (err: any) {
            console.error("Error creating election:", err);

            // More user-friendly error message
            if (err.message.includes("unknown account")) {
                setStatus("Error: Please connect your MetaMask wallet");
            } else if (err.message.includes("insufficient funds")) {
                setStatus("Error: You don't have enough ETH to create an election");
            } else if (err.message.includes("user rejected")) {
                setStatus("Transaction rejected in MetaMask");
            } else {
                setStatus(`Error: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Debug vote eligibility for a specific election and proposal
    const handleDebugCheck = (e: React.FormEvent) => {
        e.preventDefault();
        if (debugElectionAddress && debugProposalName) {
            checkVoteEligibility(debugElectionAddress, debugProposalName);
        } else {
            setDebug("Please enter both election address and proposal name");
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h1>Create New Election</h1>

            <div style={{ marginBottom: '20px' }}>
                <p>Connected account: {account || 'Not connected'}</p>
                <p>Status: {status}</p>
            </div>

            <form onSubmit={handleCreateElection}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>
                        Election Title:
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                        placeholder="Presidential Election 2025"
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>
                        Proposals (comma-separated):
                    </label>
                    <textarea
                        value={proposals}
                        onChange={(e) => setProposals(e.target.value)}
                        style={{ width: '100%', padding: '8px', minHeight: '60px' }}
                        placeholder="Proposal A, Proposal B, Proposal C"
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>
                        Voter Addresses (comma-separated):
                    </label>
                    <textarea
                        value={voters}
                        onChange={(e) => setVoters(e.target.value)}
                        style={{ width: '100%', padding: '8px', minHeight: '60px' }}
                        placeholder="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 0x..."
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>
                        Duration (hours):
                    </label>
                    <input
                        type="number"
                        value={durationHours}
                        onChange={(e) => setDurationHours(parseInt(e.target.value) || 24)}
                        style={{ width: '100%', padding: '8px' }}
                        min="1"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || !factoryContract}
                    style={{
                        padding: '10px 15px',
                        backgroundColor: loading ? '#ccc' : '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? 'Creating...' : 'Create Election'}
                </button>
            </form>

            <hr style={{ margin: '30px 0' }} />

            <h2>Debug Vote Eligibility</h2>
            <form onSubmit={handleDebugCheck}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>
                        Election Address:
                    </label>
                    <input
                        type="text"
                        value={debugElectionAddress}
                        onChange={(e) => setDebugElectionAddress(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                        placeholder="0x..."
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>
                        Proposal Name:
                    </label>
                    <input
                        type="text"
                        value={debugProposalName}
                        onChange={(e) => setDebugProposalName(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                        placeholder="Proposal A"
                    />
                </div>

                <button
                    type="submit"
                    style={{
                        padding: '10px 15px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Check Eligibility
                </button>
            </form>

            {debug && (
                <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: '#f5f5f5',
                    borderLeft: '4px solid #2196F3'
                }}>
                    <h3>Debug Info:</h3>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {debug}
                    </pre>
                </div>
            )}
        </div>
    );
}