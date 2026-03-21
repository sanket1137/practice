import { useState } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, TextField, Button, Alert,
    Switch, FormControlLabel, Divider, Avatar, IconButton, CircularProgress,
    Chip, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import {
    getProfile, updateProfile, updateVisibility, updateBankAccount,
    deleteBankAccount, changePassword, uploadProfileImage,
} from '../../services/profileApi';
import type { UpdateProfileRequest, UpdateBankAccountRequest, ChangePasswordRequest } from '../../types/profile';

export default function ProfileSettingsPage() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

    const { data: profile, isLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: getProfile,
    });

    // Profile form state
    const [profileForm, setProfileForm] = useState<UpdateProfileRequest>({
        firstName: '',
        lastName: '',
        phone: '',
        companyName: '',
        gstNumber: '',
    });

    // Bank form state
    const [bankForm, setBankForm] = useState<UpdateBankAccountRequest>({
        beneficiaryName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
    });

    // Password form state
    const [passwordForm, setPasswordForm] = useState<ChangePasswordRequest>({
        currentPassword: '',
        newPassword: '',
    });
    const [confirmPassword, setConfirmPassword] = useState('');

    // Initialize forms when profile loads
    const initialized = useState(false);
    if (profile && !initialized[0]) {
        setProfileForm({
            firstName: profile.firstName,
            lastName: profile.lastName,
            phone: profile.phone || '',
            companyName: profile.companyName || '',
            gstNumber: profile.gstNumber || '',
        });
        if (profile.bankAccount) {
            setBankForm({
                beneficiaryName: profile.bankAccount.beneficiaryName,
                accountNumber: '',
                ifscCode: profile.bankAccount.ifscCode,
                bankName: profile.bankAccount.bankName,
            });
        }
        initialized[1](true);
    }

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setErrorMsg('');
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const showError = (msg: string) => {
        setErrorMsg(msg);
        setSuccessMsg('');
    };

    const updateProfileMutation = useMutation({
        mutationFn: (req: UpdateProfileRequest) => updateProfile(req),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            showSuccess('Profile updated successfully');
        },
        onError: () => showError('Failed to update profile'),
    });

    const updateVisibilityMutation = useMutation({
        mutationFn: (visibility: string) => updateVisibility({ visibility }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            showSuccess('Visibility updated');
        },
        onError: () => showError('Failed to update visibility'),
    });

    const updateBankMutation = useMutation({
        mutationFn: (req: UpdateBankAccountRequest) => updateBankAccount(req),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            showSuccess('Bank account updated');
        },
        onError: () => showError('Failed to update bank account'),
    });

    const deleteBankMutation = useMutation({
        mutationFn: deleteBankAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            showSuccess('Bank account removed');
        },
        onError: () => showError('Failed to remove bank account'),
    });

    const changePasswordMutation = useMutation({
        mutationFn: (req: ChangePasswordRequest) => changePassword(req),
        onSuccess: () => {
            setPasswordDialogOpen(false);
            setPasswordForm({ currentPassword: '', newPassword: '' });
            setConfirmPassword('');
            showSuccess('Password changed successfully');
        },
        onError: () => showError('Failed to change password. Check your current password.'),
    });

    const uploadImageMutation = useMutation({
        mutationFn: (file: File) => uploadProfileImage(file),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            showSuccess('Profile image updated');
        },
        onError: () => showError('Failed to upload image'),
    });

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h4" fontWeight={700} mb={3}>Profile Settings</Typography>

            {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
            {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}

            <Grid container spacing={3}>
                {/* Profile Info */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" mb={2}>Personal Information</Typography>
                            <Box display="flex" alignItems="center" gap={2} mb={3}>
                                <Avatar
                                    src={profile?.profileImageUrl}
                                    sx={{ width: 64, height: 64 }}
                                >
                                    {profile?.firstName?.[0]}
                                </Avatar>
                                <Button
                                    variant="outlined"
                                    component="label"
                                    size="small"
                                    disabled={uploadImageMutation.isPending}
                                >
                                    {uploadImageMutation.isPending ? 'Uploading...' : 'Change Photo'}
                                    <input
                                        type="file"
                                        hidden
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) uploadImageMutation.mutate(file);
                                        }}
                                    />
                                </Button>
                            </Box>

                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        label="First Name"
                                        fullWidth
                                        value={profileForm.firstName}
                                        onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        label="Last Name"
                                        fullWidth
                                        value={profileForm.lastName}
                                        onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        label="Email"
                                        fullWidth
                                        value={profile?.email || ''}
                                        disabled
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        label="Phone"
                                        fullWidth
                                        value={profileForm.phone}
                                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        label="Company Name"
                                        fullWidth
                                        value={profileForm.companyName}
                                        onChange={(e) => setProfileForm({ ...profileForm, companyName: e.target.value })}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        label="GST Number"
                                        fullWidth
                                        value={profileForm.gstNumber}
                                        onChange={(e) => setProfileForm({ ...profileForm, gstNumber: e.target.value })}
                                    />
                                </Grid>
                            </Grid>

                            <Box mt={2} display="flex" gap={2}>
                                <Button
                                    variant="contained"
                                    onClick={() => updateProfileMutation.mutate(profileForm)}
                                    disabled={updateProfileMutation.isPending}
                                >
                                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => setPasswordDialogOpen(true)}
                                >
                                    Change Password
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Visibility + Role */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" mb={2}>Account</Typography>
                            <Box mb={2}>
                                <Chip label={user?.role} color="primary" size="small" />
                            </Box>
                            {user?.role === 'ScreenOwner' && (
                                <>
                                    <Divider sx={{ my: 2 }} />
                                    <Typography variant="subtitle2" mb={1}>Screen Visibility</Typography>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={profile?.accountVisibility === 'Public'}
                                                onChange={(e) => updateVisibilityMutation.mutate(e.target.checked ? 'Public' : 'Private')}
                                                disabled={updateVisibilityMutation.isPending}
                                            />
                                        }
                                        label={profile?.accountVisibility === 'Public' ? 'Public — Screens visible in explore' : 'Private — Screens hidden from explore'}
                                    />
                                </>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Bank Account (Screen Owners only) */}
                {user?.role === 'ScreenOwner' && (
                    <Grid size={{ xs: 12 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" mb={2}>
                                    Bank Account
                                    {profile?.bankAccount?.isVerified && (
                                        <Chip label="Verified" color="success" size="small" sx={{ ml: 1 }} />
                                    )}
                                </Typography>

                                {profile?.bankAccount && (
                                    <Alert severity="info" sx={{ mb: 2 }}>
                                        Current account: {profile.bankAccount.accountNumberMasked} at {profile.bankAccount.bankName}
                                    </Alert>
                                )}

                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            label="Beneficiary Name"
                                            fullWidth
                                            value={bankForm.beneficiaryName}
                                            onChange={(e) => setBankForm({ ...bankForm, beneficiaryName: e.target.value })}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            label="Account Number"
                                            fullWidth
                                            value={bankForm.accountNumber}
                                            onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                                            placeholder={profile?.bankAccount ? 'Enter new to update' : ''}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            label="IFSC Code"
                                            fullWidth
                                            value={bankForm.ifscCode}
                                            onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value.toUpperCase() })}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            label="Bank Name"
                                            fullWidth
                                            value={bankForm.bankName}
                                            onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                                        />
                                    </Grid>
                                </Grid>

                                <Box mt={2} display="flex" gap={2}>
                                    <Button
                                        variant="contained"
                                        onClick={() => updateBankMutation.mutate(bankForm)}
                                        disabled={updateBankMutation.isPending || !bankForm.accountNumber}
                                    >
                                        {updateBankMutation.isPending ? 'Saving...' : profile?.bankAccount ? 'Update Bank Account' : 'Add Bank Account'}
                                    </Button>
                                    {profile?.bankAccount && (
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            onClick={() => deleteBankMutation.mutate()}
                                            disabled={deleteBankMutation.isPending}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>

            {/* Change Password Dialog */}
            <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Change Password</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Current Password"
                        type="password"
                        fullWidth
                        sx={{ mt: 1, mb: 2 }}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    />
                    <TextField
                        label="New Password"
                        type="password"
                        fullWidth
                        sx={{ mb: 2 }}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    />
                    <TextField
                        label="Confirm New Password"
                        type="password"
                        fullWidth
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        error={confirmPassword !== '' && confirmPassword !== passwordForm.newPassword}
                        helperText={confirmPassword !== '' && confirmPassword !== passwordForm.newPassword ? 'Passwords do not match' : ''}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => changePasswordMutation.mutate(passwordForm)}
                        disabled={
                            changePasswordMutation.isPending ||
                            !passwordForm.currentPassword ||
                            !passwordForm.newPassword ||
                            passwordForm.newPassword !== confirmPassword ||
                            passwordForm.newPassword.length < 8
                        }
                    >
                        {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
