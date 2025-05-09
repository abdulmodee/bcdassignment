import React, { useState, useEffect } from 'react';
import Button from '../../components/Button';
import './votingPage.css';
import Navbar from '../../components/navbar';
import { BrowserProvider, ethers } from 'ethers';
import ElectionABI from '../../ElectionABI.json';

type Candidate = {
  id: number;
  name: string;
  image: string;
};

type Election = {
  id: number;
  title: string;
  candidates: Candidate[];
};

const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';


export default function VotingPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(
    null
  );
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null
  );
  const [votedElectionIds, setVotedElectionIds] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<any>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [account, setAccount] = useState('');
  type Proposal = { name: string; votes: number };
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [voteStatus, setVoteStatus] = useState('');
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const fetchElections = async () => {
      try {
        const response = await fetch('/api/elections'); // Replace with your actual API endpoint
        if (!response.ok) throw new Error('Failed to fetch elections');
        const data = [
          {
            id: 1,
            title: 'Presidential Election',
            candidates: [
              {
                id: 1,
                name: 'Alice Johnson',
                image: '/candidate1.jpg',
              },
              {
                id: 2,
                name: 'Bob Smith',
                image: '/candidate2.jpg',
              },
              {
                id: 3,
                name: 'Alice Johnson',
                image: '/candidate1.jpg',
              },
              {
                id: 4,
                name: 'Bob Smith',
                image: '/candidate2.jpg',
              },
            ],
          },
          {
            id: 2,
            title: 'District Election',
            candidates: [
              {
                id: 1,
                name: 'Abdurrahman Johnson',
                image: '/candidate1.jpg',
              },
              {
                id: 2,
                name: 'Youssef Smith',
                image: '/candidate2.jpg',
              },
            ],
          },
        ];

        setElections(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
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
    }
  }, []);

  // Request account access and set up contract
  useEffect(() => {
    if (!provider) return;

    const setupSigner = async () => {
      await provider.send('eth_requestAccounts', []);
      const newSigner = await provider.getSigner();
      setSigner(newSigner);
      const addr = await newSigner.getAddress();
      setAccount(addr);
      const electionContract = new ethers.Contract(CONTRACT_ADDRESS, ElectionABI.abi, newSigner);
      setContract(electionContract);
    };



    setupSigner();

  }, [provider]);

  // Load proposals and check if current user is owner
  useEffect(() => {
    async function loadData() {
      if (!contract) return;

      try {
        console.log("Contract address:", CONTRACT_ADDRESS);
        console.log("Connected account:", account);

        // First try to get owner (simpler call to verify connection)
        console.log(contract);
        try {
          const ownerAddr = await contract.owner();
          console.log("Contract owner:", ownerAddr);
          setIsOwner(ownerAddr.toLowerCase() === account.toLowerCase());
        } catch (err) {
          console.error("Error getting owner:", err);
          setError("Could not verify contract owner. Contract may be invalid.");
          return;
        }

        // Now try to get proposals with detailed error handling
        try {
          // Check totalProposals first (to verify state)
          // const totalProps = await contract.totalProposals?.();
          // console.log("Total proposals in contract:", totalProps?.toString() || "Method not found");

          // Get all proposals
          console.log("Attempting to get all proposals...");
          const raw = await contract.getAllProposals();

          console.log("Proposals data:", raw);

          if (Array.isArray(raw) && raw.length > 0) {

            const data = raw.map((p) => { return p });
            const data_2 = data.map((item) => {
              return {
                name: item.name,
                votes: item.votes
              }
            })

            setProposals(data_2);
            setError("");
          } else if (Array.isArray(raw) && raw.length === 0) {
            console.log("No proposals found in contract");
            setProposals([]);
            setError("No proposals found in the voting contract");
          } else {
            console.error("Unexpected proposals data format:", raw);
            setProposals([]);
            setError("Invalid data format received from contract");
          }
        } catch (err) {
          console.error("Error fetching proposals:", err);
          setProposals([]);
          setError("Failed to load proposals from blockchain. See console for details.");
        }
      } catch (err) {
        console.error("General contract error:", err);
        setError("Failed to interact with blockchain contract");
      }
    }

    loadData();
  }, [contract, account]);

  const handleSubmit = () => {
    if (selectedElection && selectedCandidate) {
      if (votedElectionIds.includes(selectedElection.id)) {
        setMessage('You have already voted in this election.');
        return;
      }

      // Optionally: POST vote to server here

      setMessage(
        `✅ You voted for ${selectedCandidate.name} in the ${selectedElection.title}.`
      );
      setVotedElectionIds([...votedElectionIds, selectedElection.id]);
      setSelectedElection(null);
      setSelectedCandidate(null);
    } else {
      setMessage('⚠️ Please select a candidate before submitting.');
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
