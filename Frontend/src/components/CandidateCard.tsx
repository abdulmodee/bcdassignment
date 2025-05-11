import React from 'react';
import { Box, Typography, Paper, Avatar } from '@mui/material';
import { Candidate } from '../types/electionTypes';

interface CandidateCardProps {
    candidate: Candidate;
    isSelected: boolean;
    onSelect: () => void;
    voteCount?: number;
    totalVotes?: number;
}

const CandidateCard: React.FC<CandidateCardProps> = ({
    candidate,
    isSelected,
    onSelect,
    voteCount = 0,
    totalVotes = 0
}) => {
    // Generate initials for the avatar fallback
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase();
    };

    // Calculate percentage of votes
    const votePercentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

    // Generate a consistent color based on candidate name
    const getAvatarColor = (name: string) => {
        const colors = [
            '#f44336', '#e91e63', '#9c27b0', '#673ab7',
            '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
            '#009688', '#4caf50', '#8bc34a', '#cddc39',
            '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
        ];

        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }

        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <Paper
            elevation={isSelected ? 6 : 2}
            sx={{
                p: 3,
                borderRadius: 4,
                backgroundColor: isSelected ? 'rgba(0, 200, 150, 0.1)' : '#1f1f1f',
                border: isSelected ? '2px solid #00c896' : '2px solid transparent',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                mb: 2,
                height: '100%',
                '&:hover': {
                    transform: 'scale(1.03)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                },
            }}
            onClick={onSelect}
        >
            {/* Candidate Avatar */}
            <Avatar
                src={candidate.image}
                alt={candidate.name}
                sx={{
                    width: 110,
                    height: 110,
                    mb: 2,
                    fontSize: '2.25rem',
                    fontWeight: 'bold',
                    backgroundColor: getAvatarColor(candidate.name),
                    border: isSelected
                        ? '4px solid #00c896'
                        : '4px solid rgba(255,255,255,0.1)',
                    boxShadow: isSelected
                        ? '0 0 12px rgba(0, 200, 150, 0.5)'
                        : 'none',
                    transition: 'all 0.3s ease',
                }}
            >
                {getInitials(candidate.name)}
            </Avatar>

            {/* Candidate Name */}
            <Typography
                variant="h6"
                component="h3"
                fontWeight="medium"
                sx={{
                    mb: 1,
                    color: '#fff',
                    transition: 'color 0.3s ease',
                }}
            >
                {candidate.name}
            </Typography>

            {/* Vote Count */}
            {totalVotes > 0 && (
                <Box sx={{ width: '100%', mt: 1 }}>
                    <Typography
                        variant="body2"
                        sx={{
                            color: isSelected ? '#00c896' : '#aaa',
                            transition: 'color 0.3s ease',
                            fontWeight: isSelected ? 'bold' : 'regular',
                            fontSize: '0.9rem',
                        }}
                    >
                        {voteCount} vote{voteCount !== 1 ? 's' : ''} ({votePercentage.toFixed(1)}%)
                    </Typography>

                    {/* Vote bar */}
                    <Box
                        sx={{
                            height: 6,
                            width: '100%',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            borderRadius: 3,
                            mt: 1,
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                width: `${votePercentage}%`,
                                backgroundColor: isSelected ? '#00c896' : '#4dabf5',
                                borderRadius: 3,
                                transition: 'width 1s ease-out, background-color 0.3s ease'
                            }}
                        />
                    </Box>
                </Box>
            )}
        </Paper>
    );
};

export default CandidateCard;