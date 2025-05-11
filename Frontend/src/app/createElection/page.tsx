'use client';
import React, { useState, useEffect } from 'react';
import { BrowserProvider, ethers, Contract } from 'ethers';
import FactoryABI from '../../ABI/ElectionFactoryABI.json';
import Navbar from '../../components/navbar';
import Footer from '../../components/footer';
import { useWallet } from '../../components/WalletProvider';
import {
    Box,
    Container,
    Typography,
    TextField,
    Button,
    Paper,
    Chip,
    CircularProgress,
} from '@mui/material';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import BallotIcon from '@mui/icons-material/Ballot';
import GroupIcon from '@mui/icons-material/Group';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SendIcon from '@mui/icons-material/Send';

// Update with your factory address
const FACTORY_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';

export default function CreateElectionPage() {
    // Form state
    const [title, setTitle] = useState<string>('');
    const [proposals, setProposals] = useState<string>('');
    const [voters, setVoters] = useState<string>('');
    const [durationHours, setDurationHours] = useState<number>(24);

    // Use wallet context instead of managing connection separately
    const { provider, signer, account } = useWallet();
    const [factoryContract, setFactoryContract] = useState<Contract | null>(null);

    // UI state
    const [status, setStatus] = useState<string>('');
    const [statusType, setStatusType] = useState<'success' | 'info' | 'warning' | 'error'>('info');
    const [loading, setLoading] = useState<boolean>(false);

    // Initialize factory contract when wallet is connected
    useEffect(() => {
        const initContract = async () => {
            if (!signer) return;

            try {
                const factory = new ethers.Contract(FACTORY_ADDRESS, FactoryABI.abi, signer);
                setFactoryContract(factory);
                setStatus('Ready to create elections');
                setStatusType('info');
            } catch (err: any) {
                console.error("Contract initialization error:", err);
                setStatus(`Failed to initialize: ${err.message}`);
                setStatusType('error');
            }
        };

        initContract();
    }, [signer]);

    
    // Handle form submission
    const handleCreateElection = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!factoryContract) {
            setStatus('Contract not initialized');
            setStatusType('error');
            return;
        }

        if (!title || !proposals || !voters) {
            setStatus('Please fill all required fields');
            setStatusType('warning');
            return;
        }

        setLoading(true);
        setStatus('Creating election...');
        setStatusType('info');

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
            setStatusType('info');

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
            setStatusType('error');
        } finally {
            setLoading(false);
        }
    };

    // Debug vote eligibility for a specific election and proposal
    

    return (
        <>
            {/* Hero Section */}
            <Box
                sx={{
                    background: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
                    color: "#fff",
                    px: { xs: 3, md: 8 },
                    py: { xs: 6, md: 10 },
                }}
            >
                <Navbar />
                <Container maxWidth="lg">
                    <Box textAlign="center" py={8}>
                        <Typography
                            variant="h2"
                            sx={{
                                fontWeight: "bold",
                                mb: 3,
                                textShadow: "0 4px 6px rgba(0,0,0,0.3)"
                            }}
                        >
                            Create New Election
                        </Typography>
                        <Typography
                            variant="h6"
                            sx={{ maxWidth: 700, mx: "auto", color: "#d1d1d1", mb: 4 }}
                        >
                            Set up a secure blockchain-based election with customizable proposals and voter lists
                        </Typography>
                    </Box>
                </Container>
            </Box>

            {/* Main Content */}
            <Box
                sx={{
                    py: { xs: 8, md: 12 },
                    px: { xs: 3, md: 6 },
                    backgroundColor: '#121212',
                    color: '#fff',
                    minHeight: '100vh'
                }}
            >
                <Container maxWidth="lg">
                    {/* Status Box */}
                    <Box mb={6} display="flex" justifyContent="center">
                        <Chip
                            icon={account ? <CheckCircleOutlineIcon /> : undefined}
                            label={account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : 'Wallet Not Connected'}
                            color={account ? "success" : "error"}
                            variant="outlined"
                            sx={{
                                fontSize: '1rem',
                                py: 2.5,
                                px: 1.5,
                                borderRadius: 3,
                                backgroundColor: account ? 'rgba(46, 196, 182, 0.1)' : 'rgba(244, 67, 54, 0.1)'
                            }}
                        />
                    </Box>

                    {/* {status && (
                        <Alert
                            severity={statusType}
                            variant="filled"
                            sx={{
                                mb: 4,
                                borderRadius: 2,
                                '& .MuiAlert-message': { fontSize: '1rem' }
                            }}
                        >
                            {status}
                        </Alert>
                    )} */}

                    {/* Create Election Form */}
                    <Paper
                        elevation={3}
                        sx={{
                            p: { xs: 3, md: 5 },
                            borderRadius: 4,
                            backgroundColor: '#1f1f1f',
                            mb: 6,
                            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                        }}
                    >
                        <Typography variant="h4" fontWeight="bold" mb={4} color="white">
                            Election Details
                        </Typography>

                        <Box component="form" onSubmit={handleCreateElection} noValidate>
                            <Box sx={{ mb: 4 }}>
                                <Box display="flex" alignItems="center" mb={1}>
                                    <BallotIcon sx={{ color: '#00c896', mr: 1 }} />
                                    <Typography variant="h6" color="white">
                                        Election Title
                                    </Typography>
                                </Box>
                                <TextField
                                    fullWidth
                                    placeholder="Presidential Election 2025"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    variant="outlined"
                                    required
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: 'rgba(255, 255, 255, 0.23)',
                                            },
                                            '&:hover fieldset': {
                                                borderColor: '#00c896',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#00c896',
                                            },
                                            color: 'white',
                                            borderRadius: 2,
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: 'white',
                                        },
                                    }}
                                />
                            </Box>

                            <Box sx={{ mb: 4 }}>
                                <Box display="flex" alignItems="center" mb={1}>
                                    <HowToVoteIcon sx={{ color: '#00c896', mr: 1 }} />
                                    <Typography variant="h6" color="white">
                                        Candidates (comma-separated)
                                    </Typography>
                                </Box>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    placeholder="Candidate A, Candidate B, Candidate C"
                                    value={proposals}
                                    onChange={(e) => setProposals(e.target.value)}
                                    variant="outlined"
                                    required
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: 'rgba(255, 255, 255, 0.23)',
                                            },
                                            '&:hover fieldset': {
                                                borderColor: '#00c896',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#00c896',
                                            },
                                            color: 'white',
                                            borderRadius: 2,
                                        },
                                    }}
                                />
                            </Box>

                            <Box sx={{ mb: 4 }}>
                                <Box display="flex" alignItems="center" mb={1}>
                                    <GroupIcon sx={{ color: '#00c896', mr: 1 }} />
                                    <Typography variant="h6" color="white">
                                        Voter Addresses (comma-separated)
                                    </Typography>
                                </Box>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    placeholder="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 0x..."
                                    value={voters}
                                    onChange={(e) => setVoters(e.target.value)}
                                    variant="outlined"
                                    required
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: 'rgba(255, 255, 255, 0.23)',
                                            },
                                            '&:hover fieldset': {
                                                borderColor: '#00c896',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#00c896',
                                            },
                                            color: 'white',
                                            borderRadius: 2,
                                        },
                                    }}
                                />
                            </Box>

                            <Box sx={{ mb: 6 }}>
                                <Box display="flex" alignItems="center" mb={1}>
                                    <AccessTimeIcon sx={{ color: '#00c896', mr: 1 }} />
                                    <Typography variant="h6" color="white">
                                        Duration (hours)
                                    </Typography>
                                </Box>
                                <TextField
                                    fullWidth
                                    type="number"
                                    value={durationHours}
                                    onChange={(e) => setDurationHours(parseInt(e.target.value) || 24)}
                                    variant="outlined"
                                    required
                                    inputProps={{ min: 1 }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: 'rgba(255, 255, 255, 0.23)',
                                            },
                                            '&:hover fieldset': {
                                                borderColor: '#00c896',
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#00c896',
                                            },
                                            color: 'white',
                                            borderRadius: 2,
                                        },
                                    }}
                                />
                            </Box>

                            <Button
                                type="submit"
                                variant="contained"
                                disabled={loading || !factoryContract || !account}
                                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                                sx={{
                                    backgroundColor: "#00c896",
                                    px: 5,
                                    py: 1.5,
                                    fontSize: "1.1rem",
                                    borderRadius: "30px",
                                    boxShadow: "0 4px 20px rgba(0,200,150,0.4)",
                                    textTransform: "none",
                                    transition: "all 0.3s ease-in-out",
                                    "&:hover": {
                                        backgroundColor: "#00e6ac",
                                        boxShadow: "0 6px 25px rgba(0,230,172,0.6)"
                                    },
                                    "&:disabled": {
                                        backgroundColor: "rgba(0, 200, 150, 0.3)",
                                    }
                                }}
                            >
                                {loading ? 'Creating...' : 'Create Election'}
                            </Button>
                        </Box>
                    </Paper>
                    
                </Container>
            </Box>

            <Footer />
        </>
    );
}