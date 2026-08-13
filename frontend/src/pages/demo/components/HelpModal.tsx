// HelpModal - User instructions for demo page
import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Tabs,
    Tab,
    Box,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    List,
    ListItem,
    ListItemText,
    Chip,
    Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

interface HelpModalProps {
    open: boolean;
    onClose: () => void;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`help-tabpanel-${index}`}
            aria-labelledby={`help-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

export const HelpModal: React.FC<HelpModalProps> = ({ open, onClose }) => {
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { height: '80vh' }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HelpOutlineIcon color="primary" />
                    <Typography variant="h6">PixelCCMS Demo Guide</Typography>
                </Box>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <Divider />

            <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="help tabs">
                    <Tab label="🎬 Advertiser" />
                    <Tab label="📺 Screen Owner" />
                    <Tab label="❓ FAQs" />
                </Tabs>
            </Box>

            <DialogContent sx={{ p: 0, overflow: 'auto' }}>
                {/* Welcome Section - Shows on all tabs */}
                {tabValue === 0 && (
                    <Box sx={{ px: 3, pt: 2, pb: 1, bgcolor: 'primary.lighter' }}>
                        <Typography variant="h6" gutterBottom>
                            Welcome to PixelCCMS Demo!
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Experience how our platform revolutionizes outdoor advertising. Book premium LED screen slots and track your campaigns in real-time.
                        </Typography>
                    </Box>
                )}

                {/* Advertiser Tab */}
                <TabPanel value={tabValue} index={0}>
                    <Box sx={{ px: 3 }}>
                        <Accordion defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">Step 1: Upload Your Campaign Video</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2" gutterBottom>
                                    <strong>Location:</strong> Left panel → "Upload Your Campaign Video"
                                </Typography>
                                <List dense>
                                    <ListItem>
                                        <ListItemText
                                            primary="1. Click the upload area or drag-and-drop your MP4 video"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="2. Video preview appears automatically"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="3. Ready to book slots!"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                </List>
                                <Chip label="💡 Tip: Use videos under 50MB" size="small" color="info" sx={{ mt: 1 }} />
                            </AccordionDetails>
                        </Accordion>

                        <Accordion defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">Step 2: Create a Booking</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2" gutterBottom>
                                    <strong>Location:</strong> Left panel → "Create Booking"
                                </Typography>
                                <List dense>
                                    <ListItem>
                                        <ListItemText
                                            primary="1. Select screen: Choose 'Bandra-Worli' or 'MG Road'"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="2. Pick slot numbers: Select from 6 available slots"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="3. Set duration: Max 100 plays"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="4. Review cost: ₹10 per play"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="5. Click 'Create Booking'"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                </List>
                                <Box sx={{ mt: 2, p: 2, bgcolor: 'success.lighter', borderRadius: 1 }}>
                                    <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                                        What Happens Next:
                                    </Typography>
                                    <Typography variant="caption" display="block">
                                        • Booking enters approval queue<br />
                                        • Status shows "PENDING"<br />
                                        • Auto-approved in 2 seconds (demo mode)
                                    </Typography>
                                </Box>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">Step 3: Track Your Campaign</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2" gutterBottom>
                                    <strong>Location:</strong> Left panel → "Your Campaign is Live!"
                                </Typography>
                                <List dense>
                                    <ListItem>
                                        <ListItemText
                                            primary="✅ Live Preview: See your ad rotating with others"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="📊 Stats: Monitor plays and cost in real-time"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="📋 Booking Table: Check status (Approved/Pending/Rejected)"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                </List>
                                <Box sx={{ mt: 2, p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
                                    <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                                        Expected Behavior:
                                    </Typography>
                                    <Typography variant="caption" display="block">
                                        • Video plays in rotation every 60 seconds<br />
                                        • Play count increments automatically<br />
                                        • Cost updates: ₹10 per play
                                    </Typography>
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    </Box>
                </TabPanel>

                {/* Screen Owner Tab */}
                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ px: 3 }}>
                        <Accordion defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">Step 1: Monitor Your Screens</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2" gutterBottom>
                                    <strong>Location:</strong> Right panel → Screen cards
                                </Typography>
                                <List dense>
                                    <ListItem>
                                        <ListItemText
                                            primary="🎥 Live Preview: See rotating slot content"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="💰 Revenue: Track earnings (₹10 per play)"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="📊 Slot Availability: Green = Booked, Gray = Empty"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                </List>
                                <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.lighter', borderRadius: 1 }}>
                                    <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                                        Key Metrics:
                                    </Typography>
                                    <Typography variant="caption" display="block">
                                        • Booked Slots: 6/6 = full occupancy<br />
                                        • Current Revenue: Total earnings<br />
                                        • Occupancy: % of filled slots
                                    </Typography>
                                </Box>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">Step 2: Approve Bookings</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2" gutterBottom>
                                    <strong>Location:</strong> Right panel → "Booking Queue"
                                </Typography>
                                <List dense>
                                    <ListItem>
                                        <ListItemText
                                            primary="1. New booking appears in queue"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="2. Review: Slot number, advertiser, duration"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="3. Click 'Approve' or 'Reject'"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="4. Approved bookings go live instantly"
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItem>
                                </List>
                                <Box sx={{ mt: 2, p: 2, bgcolor: 'success.lighter', borderRadius: 1 }}>
                                    <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
                                        After Approval:
                                    </Typography>
                                    <Typography variant="caption" display="block">
                                        • Advertiser's video joins rotation<br />
                                        • Revenue starts accumulating<br />
                                        • Slot turns green (booked)
                                    </Typography>
                                </Box>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">Step 3: Track Revenue & Logs</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2" gutterBottom>
                                    <strong>Location:</strong> Right panel → Bottom sections
                                </Typography>
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
                                    Revenue by Campaign:
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                                    Nike Sports (Slot 1): ₹20 | 2 plays<br />
                                    Coca-Cola (Slot 2): ₹30 | 3 plays<br />
                                    Total Revenue: ₹100 from 10 plays
                                </Typography>

                                <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
                                    Screen Play Logs:
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                                    ▶️ Slot stream started - 18:08:42<br />
                                    📋 Approved - Slot 4 booked - 17:36:39
                                </Typography>
                            </AccordionDetails>
                        </Accordion>
                    </Box>
                </TabPanel>

                {/* FAQs Tab */}
                <TabPanel value={tabValue} index={2}>
                    <Box sx={{ px: 3 }}>
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">Video not uploading?</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2">
                                    Ensure video is MP4 format, under 50MB. Refresh page and try again.
                                </Typography>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">Play count not increasing?</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2">
                                    Ensure slot has approved booking (green indicator). Empty slots (gray) don't count plays.
                                </Typography>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">Revenue shows ₹0?</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2">
                                    Wait for first full rotation (60 seconds). Default content slots don't generate revenue.
                                </Typography>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">How does synchronized playback work?</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2">
                                    Both advertiser and screen owner panels show the same slots at the same time. When Slot 3 plays on the right, it plays on the left too - true live synchronization!
                                </Typography>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">What's the pricing model?</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2" gutterBottom>
                                    ₹10 per play × Number of plays = Total cost
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1, fontFamily: 'monospace' }}>
                                    Example:<br />
                                    Book 50 plays = ₹500<br />
                                    Each 60s rotation = 1 play
                                </Typography>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">How to reset the demo?</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography variant="body2" gutterBottom>
                                    Open browser console (F12) and run:
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ mt: 1, p: 1, bgcolor: 'grey.900', color: 'white', borderRadius: 1, fontFamily: 'monospace' }}>
                                    localStorage.clear()
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    Then refresh the page. All bookings, videos, and stats will reset to default.
                                </Typography>
                            </AccordionDetails>
                        </Accordion>
                    </Box>
                </TabPanel>
            </DialogContent>
        </Dialog>
    );
};
