'use client';
import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, Alert } from '@mui/material';
import Button from '../../components/Button';
import './votingPage.css';
import Navbar from '../../components/navbar';
import { ethers } from 'ethers';
import ElectionABI from '../../ABI/ElectionABI.json';
import FactoryABI from '../../ABI/ElectionFactoryABI.json';
import { useWallet } from '../../components/WalletProvider';
import ElectionCard from '../../components/ElectionCard';
import CandidateCard from '../../components/CandidateCard';
import VoteCountDashboard from '../../components/VoteCountDashboard';
import VoterParticipationMetrics from '../../components/VoterParticipationMetrics';
import { Election, Candidate, Proposal } from '../../types/electionTypes';

// Update this with your deployed factory address
const FACTORY_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';

export default function VotingPage() {
  // State variables remain the same
  const { provider, signer, account } = useWallet();
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [votedElectionIds, setVotedElectionIds] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [electionContracts, setElectionContracts] = useState<{ [key: number]: ethers.Contract }>({});
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [voterMetrics, setVoterMetrics] = useState<{ [key: number]: { total: number, voted: number } }>({});

  // All useEffect hooks remain the same
  useEffect(() => {
    if (!signer || !account) return;

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

  // Fetch blockchain elections (keep as is)
  useEffect(() => {
    if (!factoryContract || !signer || !account) return;

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
        const newVoterMetrics: { [key: number]: { total: number, voted: number } } = {};

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
              [i + 1]: electionContract
            }));

            // Get proposals with votes
            const rawProposals = await electionContract.getAllProposals();
            let totalVotes = 0;

            const candidates = rawProposals.map((p: any, index: number) => {
              totalVotes += Number(p.votes);
              return {
                id: index + 1,
                name: p.name,
                image: '/candidate-placeholder.jpg',
                votes: Number(p.votes)
              };
            });

            // Check if user has voted
            const hasVoted = await electionContract.hasVoted(account);
            if (hasVoted && !votedElectionIds.includes(i + 1)) {
              setVotedElectionIds(prev => [...prev, i + 1]);
            }

            // Get voter metrics
            const allowedVoters = details.allowedVoters || [];
            const voterCount = allowedVoters.length;

            // Count how many have voted
            let votedCount = 0;
            for (const voter of allowedVoters) {
              try {
                const hasVoted = await electionContract.hasVoted(voter);
                if (hasVoted) votedCount++;
              } catch (err) {
                console.error(`Error checking if voter ${voter} has voted:`, err);
              }
            }

            newVoterMetrics[i + 1] = {
              total: voterCount,
              voted: votedCount
            };

            // Create election object
            const election: Election = {
              id: i + 1,
              title: details.title,
              candidates: candidates,
              address: details.electionAddress,
              ended: details.ended,
              startTime: Number(details.startTime),
              endTime: Number(details.endTime),
              allowedVoters: details.allowedVoters
            };

            blockchainElections.push(election);
          } catch (err) {
            console.error(`Error fetching election at index ${i}:`, err);
          }
        }

        // Set voter metrics
        setVoterMetrics(newVoterMetrics);

        // Replace elections with blockchain elections
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

  // Update selected election's proposals (keep as is)
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

  // Handle blockchain vote submission (keep as is)
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

      // Update voter metrics
      setVoterMetrics(prev => {
        const metrics = { ...prev };
        if (metrics[selectedElection.id]) {
          metrics[selectedElection.id].voted += 1;
        }
        return metrics;
      });

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

  // Wallet not connected UI (keep as is)
  if (!provider || !signer || !account) {
    return (
      <>
        <div className="voting-container">
          <Navbar />
          <h1 className="voting-title">🗳️ Ongoing Elections</h1>

          <div className="wallet-connect-prompt">
            <h2 style={{ color: 'white' }}>Connect Your Wallet</h2>
            <p style={{ color: 'white' }}>Please connect your wallet using the button in the navigation bar to view and participate in elections.</p>
            <div className="mt-4">
              <Button
                typeofButton="primary"
                onClickButton={() => window.location.href = '/howItWorks'}
              >
                Learn How It Works
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (loading) return (
    <>
      <Navbar />
      <div className="loading">Loading elections...</div>
    </>
  );

  if (error) return (
    <>
      <Navbar />
      <div className="error">{error}</div>
    </>
  );

  return (
    <>
      <Box
        sx={{
          background: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
          minHeight: '100vh',
          color: '#fff',
          px: { xs: 3, md: 8 },  // Add horizontal padding like home page
          py: { xs: 6, md: 2 }   // Add vertical padding like home page
        }}
      >
        <Navbar />

        <Container maxWidth="lg" sx={{ py: 6 }}>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 'bold',
              mb: 4,
              textAlign: 'center'
            }}
          >
            🗳️ Elections
          </Typography>

          {message && (
            <Alert
              severity={message.includes('✅') ? 'success' : message.includes('⚠️') ? 'warning' : 'info'}
              sx={{
                mb: 4,
                borderRadius: 2,
                '& .MuiAlert-message': { fontSize: '1rem' }
              }}
            >
              {message}
            </Alert>
          )}

          {!selectedElection ? (
            // Elections list using flexbox instead of Grid
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 3,
                justifyContent: 'center'
              }}
            >
              {elections.map((election) => {
                const alreadyVoted = votedElectionIds.includes(election.id);
                const metrics = voterMetrics[election.id] || { total: 0, voted: 0 };

                return (
                  <Box
                    key={election.id}
                    sx={{
                      width: {
                        xs: '100%',
                        sm: 'calc(50% - 24px)',
                        lg: 'calc(33.33% - 24px)'
                      },
                      minWidth: {
                        xs: '100%',
                        sm: '280px',
                        lg: '300px'
                      },
                      maxWidth: '500px',
                      flex: '1 1 auto'
                    }}
                  >
                    <ElectionCard
                      election={election}
                      alreadyVoted={alreadyVoted}
                      onSelect={() => {
                        if (!alreadyVoted) {
                          setSelectedElection(election);
                          setMessage('');
                        }
                      }}
                      totalVoters={metrics.total}
                      votedCount={metrics.voted}
                    />
                  </Box>
                );
              })}

              {elections.length === 0 && (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 8,
                    color: '#aaa',
                    width: '100%'
                  }}
                >
                  <Typography variant="h5" gutterBottom>
                    No elections found
                  </Typography>
                  <Typography variant="body1">
                    There are no active elections available at this time.
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <Box>
              {/* Back button */}
              <Box sx={{ mb: 4 }}>
                <Button
                  typeofButton="info"
                  onClickButton={() => {
                    setSelectedElection(null);
                    setSelectedCandidate(null);
                    setMessage('');
                  }}
                >
                  ← Back to Elections
                </Button>
              </Box>

              {/* Election title */}
              <Typography
                variant="h3"
                component="h2"
                sx={{
                  fontWeight: 'bold',
                  mb: 4,
                  textAlign: 'center',
                  color: '#fff'
                }}
              >
                {selectedElection.title}
              </Typography>

              {/* If election has ended or user has voted, show results */}
              {(selectedElection.ended || votedElectionIds.includes(selectedElection.id)) && (
                <>
                  {/* Vote count dashboard */}
                  <VoteCountDashboard
                    title={selectedElection.title}
                    candidates={selectedElection.candidates}
                    voteData={proposals}
                    totalVotes={proposals.reduce((sum, p) => sum + p.votes, 0)}
                  />

                  {/* Voter participation metrics */}
                  <VoterParticipationMetrics
                    totalVoters={voterMetrics[selectedElection.id]?.total || 0}
                    votedCount={voterMetrics[selectedElection.id]?.voted || 0}
                    electionTitle={selectedElection.title}
                  />
                </>
              )}

              {/* Candidates section */}
              <Box sx={{ mb: 6 }}>
                <Typography
                  variant="h5"
                  component="h3"
                  sx={{
                    fontWeight: 'bold',
                    mb: 3,
                    textAlign: 'center',
                    color: selectedElection.ended ? '#aaa' : '#fff',
                  }}
                >
                  {selectedElection.ended ? 'Final Results' : votedElectionIds.includes(selectedElection.id) ? 'Current Results' : 'Select a Candidate'}
                </Typography>

                {/* Candidates using flexbox instead of Grid */}
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 3,
                    justifyContent: 'center'
                  }}
                >
                  {selectedElection.candidates.map((candidate) => {
                    const candidateVotes = proposals.find(p => p.name === candidate.name)?.votes || 0;
                    const totalVotes = proposals.reduce((sum, p) => sum + p.votes, 0);

                    return (
                      <Box
                        key={candidate.id}
                        sx={{
                          width: {
                            xs: '100%',
                            sm: 'calc(50% - 24px)',
                            md: 'calc(33.33% - 24px)'
                          },
                          minWidth: {
                            xs: '100%',
                            sm: '250px',
                            md: '250px'
                          },
                          maxWidth: '400px',
                          flex: '1 1 auto',
                          display: 'flex'
                        }}
                      >
                        <CandidateCard
                          candidate={candidate}
                          isSelected={selectedCandidate?.id === candidate.id}
                          onSelect={() => {
                            if (!selectedElection.ended && !votedElectionIds.includes(selectedElection.id)) {
                              setSelectedCandidate(candidate);
                            }
                          }}
                          voteCount={candidateVotes}
                          totalVotes={totalVotes}
                        />
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {/* Submit button */}
              {!selectedElection.ended && !votedElectionIds.includes(selectedElection.id) && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
                  <Button
                    typeofButton="danger"
                    onClickButton={handleBlockchainVote}
                  // disabled={!selectedCandidate}
                  >
                    {loading ? 'Processing...' : 'Submit Vote'}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Container>
      </Box>
    </>
  );
}
