import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import './votingPage.css';
import Navbar from '../../components/navbar';
import { BrowserProvider, ethers } from 'ethers';
import ElectionABI from '../../ABI/ElectionABI.json';
import FactoryABI from '../../ABI/ElectionFactoryABI.json';

// Update this with your deployed factory address
const FACTORY_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

type Candidate = {
  id: number;
  name: string;
  image: string;
};

type Election = {
  id: number;
  title: string;
  candidates: Candidate[];
  address?: string; // Add blockchain address
  ended?: boolean;   // Add ended status
};

export default function VotingPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [votedElectionIds, setVotedElectionIds] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Blockchain state
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<any>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [account, setAccount] = useState('');
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [electionContracts, setElectionContracts] = useState<{[key: number]: ethers.Contract}>({});
  
  type Proposal = { name: string; votes: number };
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [voteStatus, setVoteStatus] = useState('');
  const [isOwner, setIsOwner] = useState(false);

  // Initialize mock elections (keep this for UI testing)
  useEffect(() => {
    const fetchElections = async () => {
      try {
        // Keep your mock data for now
        const data = [
          {
            id: 1,
            title: 'Presidential Election',
            candidates: [
              { id: 1, name: 'Alice Johnson', image: '/candidate1.jpg' },
              { id: 2, name: 'Bob Smith', image: '/candidate2.jpg' },
              { id: 3, name: 'Alice Johnson', image: '/candidate1.jpg' },
              { id: 4, name: 'Bob Smith', image: '/candidate2.jpg' },
            ],
          },
          {
            id: 2,
            title: 'District Election',
            candidates: [
              { id: 1, name: 'Abdurrahman Johnson', image: '/candidate1.jpg' },
              { id: 2, name: 'Youssef Smith', image: '/candidate2.jpg' },
            ],
          },
        ];

        // For now, keep using mock data but we'll supplement with blockchain data
        setElections(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        // Don't set loading to false yet, wait for blockchain connection
      }
    };

    fetchElections();
  }, []);

  // Initialize ethers provider
  useEffect(() => {
    if (window.ethereum) {
      const newProvider = new BrowserProvider(window.ethereum);
      setProvider(newProvider);
    } else {
      console.error('MetaMask not detected');
      setLoading(false); // Stop loading if no MetaMask
    }
  }, []);

  // Initialize signer
  useEffect(() => {
    if (!provider) return;

    const setupSigner = async () => {
      try {
        await provider.send('eth_requestAccounts', []);
        const newSigner = await provider.getSigner();
        setSigner(newSigner);
        const addr = await newSigner.getAddress();
        setAccount(addr);
      } catch (err) {
        console.error("Error setting up signer:", err);
        setLoading(false);
      }
    };

    setupSigner();
  }, [provider]);

  // Initialize factory contract
  useEffect(() => {
    if (!signer) return;

    const initFactory = async () => {
      try {
        const factory = new ethers.Contract(FACTORY_ADDRESS, FactoryABI.abi, signer);
        setFactoryContract(factory);
        
        // Check if user is factory owner
        const ownerAddr = await factory.owner();
        setIsOwner(ownerAddr.toLowerCase() === account.toLowerCase());
      } catch (err) {
        console.error("Error initializing factory contract:", err);
      }
    };

    initFactory();
  }, [signer, account]);

  // Fetch blockchain elections
  useEffect(() => {
    if (!factoryContract) return;

    const fetchBlockchainElections = async () => {
      try {
        // Get all election addresses
        const electionAddresses = await factoryContract.getAllElections();
        
        if (electionAddresses.length === 0) {
          console.log("No elections found on blockchain");
          setLoading(false);
          return;
        }

        // Create array to store blockchain elections
        const blockchainElections: Election[] = [];

        // Loop through each election address
        for (let i = 0; i < electionAddresses.length; i++) {
          try {
            // Get election details
            const details = await factoryContract.getElectionDetails(i);
            
            // Create election contract instance
            const electionContract = new ethers.Contract(
              details.electionAddress, 
              ElectionABI.abi, 
              signer
            );

            // Store contract reference for later use
            setElectionContracts(prev => ({
              ...prev,
              [i+1]: electionContract // Use 1-based indexing to match your mock data
            }));

            // Get proposals
            const rawProposals = await electionContract.getAllProposals();
            const candidates = rawProposals.map((p: any, index: number) => ({
              id: index + 1,
              name: p.name,
              image: '/candidate-placeholder.jpg' // Default image
            }));

            // Check if user has voted
            const hasVoted = await electionContract.hasVoted(account);
            if (hasVoted && !votedElectionIds.includes(i+1)) {
              setVotedElectionIds(prev => [...prev, i+1]);
            }

            // Create election object
            const election: Election = {
              id: i + 1, // Use 1-based indexing to match your mock data
              title: details.title,
              candidates: candidates,
              address: details.electionAddress,
              ended: details.ended
            };

            blockchainElections.push(election);
          } catch (err) {
            console.error(`Error fetching election at index ${i}:`, err);
          }
        }

        // Replace mock elections with blockchain elections
        if (blockchainElections.length > 0) {
          setElections(blockchainElections);
        }
      } catch (err) {
        console.error("Error fetching blockchain elections:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockchainElections();
  }, [factoryContract, signer, account]);

  // Update selected election's proposals
  useEffect(() => {
    if (!selectedElection || !electionContracts[selectedElection.id]) return;

    const fetchProposals = async () => {
      try {
        const electionContract = electionContracts[selectedElection.id];
        
        // Get all proposals
        const rawProposals = await electionContract.getAllProposals();
        
        if (Array.isArray(rawProposals) && rawProposals.length > 0) {
          const formattedProposals = rawProposals.map((p: any) => ({
            name: p.name,
            votes: Number(p.votes)
          }));
          setProposals(formattedProposals);
          setError("");
        } else {
          console.log("No proposals found for selected election");
          setProposals([]);
          setError("No proposals found for this election");
        }
      } catch (err) {
        console.error("Error fetching proposals for selected election:", err);
        setError("Failed to load election details");
      }
    };

    fetchProposals();
  }, [selectedElection, electionContracts]);

  // Handle blockchain vote submission
  const handleBlockchainVote = async () => {
    if (!selectedElection || !selectedCandidate || !electionContracts[selectedElection.id]) {
      setMessage('⚠️ Please select a candidate first.');
      return;
    }

    if (votedElectionIds.includes(selectedElection.id)) {
      setMessage('⚠️ You have already voted in this election.');
      return;
    }

    // Set loading state
    setLoading(true);
    setMessage('📝 Submitting your vote to the blockchain...');

    try {
      const electionContract = electionContracts[selectedElection.id];
      
      // Submit vote transaction
      const tx = await electionContract.vote(selectedCandidate.name);
      await tx.wait();
      
      // Update voted election IDs
      setVotedElectionIds([...votedElectionIds, selectedElection.id]);
      setMessage(`✅ You voted for ${selectedCandidate.name} in the ${selectedElection.title}.`);
      
      // Reset selection
      setSelectedElection(null);
      setSelectedCandidate(null);
    } catch (err: any) {
      console.error("Error submitting vote:", err);
      setMessage(`⚠️ Error: ${err.message || 'Failed to submit vote'}`);
    } finally {
      setLoading(false);
    }
  };

  // Override the original handleSubmit to use blockchain voting
  const handleSubmit = () => {
    // If we have a blockchain connection, use that
    if (electionContracts[selectedElection?.id || 0]) {
      handleBlockchainVote();
    } else {
      // Fallback to mock voting for testing
      if (selectedElection && selectedCandidate) {
        if (votedElectionIds.includes(selectedElection.id)) {
          setMessage('You have already voted in this election.');
          return;
        }

        setMessage(
          `✅ You voted for ${selectedCandidate.name} in the ${selectedElection.title}.`
        );
        setVotedElectionIds([...votedElectionIds, selectedElection.id]);
        setSelectedElection(null);
        setSelectedCandidate(null);
      } else {
        setMessage('⚠️ Please select a candidate before submitting.');
      }
    }
  };

  if (loading) return <div className="loading">Loading elections...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <>
      <div className="voting-container">
        <Navbar />
        <h1 className="voting-title">🗳️ Ongoing Elections</h1>

        {!selectedElection ? (
          <ul className="election-list">
            {elections.map((election) => {
              const alreadyVoted = votedElectionIds.includes(election.id);
              return (
                <li
                  key={election.id}
                  className={`election-item ${alreadyVoted ? 'election-voted' : 'election-active'
                    }`}
                  onClick={() => {
                    if (!alreadyVoted) {
                      setSelectedElection(election);
                      setMessage('');
                    }
                  }}
                >
                  <div className="election-title">{election.title}</div>
                  {alreadyVoted && (
                    <div className="election-note">You already voted</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-6">
            <div className="back-button">
              <Button
                typeofButton="info"
                onClickButton={() => {
                  setSelectedElection(null);
                  setSelectedCandidate(null);
                  setMessage('');
                }}
              >
                ←
              </Button>
            </div>

            <div>
              <h2 className="candidates-heading">
                Candidates for{' '}
                <span className="text-blue-600">{selectedElection.title}</span>
              </h2>
            </div>

            <ul className="candidates-container">
              {selectedElection.candidates.map((candidate) => (
                <li
                  key={candidate.id}
                  className={`candidate-card ${selectedCandidate?.id === candidate.id
                    ? 'candidate-selected'
                    : 'candidate-default'
                    }`}
                  onClick={() => setSelectedCandidate(candidate)}
                >
                  <img
                    src={candidate.image || 'https://via.placeholder.com/150'}
                    alt={candidate.name}
                    className="candidate-image"
                  />
                  <div className="candidate-name">{candidate.name}</div>
                </li>
              ))}
            </ul>

            <div className="submit-button-wrapper">
              <Button typeofButton="danger" onClickButton={handleSubmit}>
                Submit Vote
              </Button>
            </div>

            {message && (
              <div
                className={`message ${message.includes('✅') ? 'message-success' : 'message-warning'
                  }`}
              >
                {message}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
