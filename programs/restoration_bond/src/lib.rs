use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

declare_id!("E33zGy2Sb8qYU4uRMzH59EqCq6Ut75oj8DjUMeTtLXvQ");

pub const MAX_URI_LEN: usize = 200;
pub const MAX_REASON_LEN: usize = 500;
pub const MAX_TYPE_LEN: usize = 48;

#[program]
pub mod restoration_bond {
    use super::*;

    pub fn create_project(
        ctx: Context<CreateProject>,
        project_id: [u8; 32],
        auditor: Pubkey,
        regulator: Pubkey,
        community_authority: Pubkey,
        financial_observer: Option<Pubkey>,
        metadata_hash: [u8; 32],
        metadata_uri: String,
        release_recipient: Pubkey,
    ) -> Result<()> {
        validate_hash(&metadata_hash)?;
        validate_uri(&metadata_uri)?;
        let company = ctx.accounts.company.key();
        require_keys_neq!(company, auditor, GroundTruthError::RolesMustBeDistinct);
        require_keys_neq!(company, regulator, GroundTruthError::RolesMustBeDistinct);
        require_keys_neq!(
            company,
            community_authority,
            GroundTruthError::RolesMustBeDistinct
        );
        require_keys_neq!(auditor, regulator, GroundTruthError::RolesMustBeDistinct);
        require_keys_neq!(
            auditor,
            community_authority,
            GroundTruthError::RolesMustBeDistinct
        );
        require_keys_neq!(
            regulator,
            community_authority,
            GroundTruthError::RolesMustBeDistinct
        );
        require!(
            release_recipient != Pubkey::default(),
            GroundTruthError::InvalidReleaseRecipient
        );

        let now = Clock::get()?.unix_timestamp;
        let project = &mut ctx.accounts.project;
        project.bump = ctx.bumps.project;
        project.project_id = project_id;
        project.company = company;
        project.auditor = auditor;
        project.regulator = regulator;
        project.community_authority = community_authority;
        project.financial_observer = financial_observer;
        project.metadata_hash = metadata_hash;
        project.metadata_uri = metadata_uri.clone();
        project.latest_evidence = None;
        project.latest_verified_evidence = None;
        project.latest_liability_decision = None;
        project.latest_correction = None;
        project.evidence_count = 0;
        project.liability_proposal_count = 0;
        project.dispute_count = 0;
        project.correction_count = 0;
        project.event_sequence = 1;
        project.active_dispute_count = 0;
        project.outstanding_correction_count = 0;
        project.current_approved_liability = 0;
        project.current_liability_revision = 0;
        project.created_at = now;

        let bond = &mut ctx.accounts.bond;
        bond.project = project.key();
        bond.bump = ctx.bumps.bond;
        bond.token_mint = ctx.accounts.token_mint.key();
        bond.vault = ctx.accounts.vault.key();
        bond.deposited_amount = 0;
        bond.released_amount = 0;
        bond.required_amount = 0;
        bond.liability_revision = 0;
        bond.status = BondStatus::Unfunded;
        bond.release_paused = false;
        bond.release_recipient = release_recipient;
        bond.last_updated_at = now;

        emit!(ProjectCreated {
            project: project.key(),
            actor: company,
            record: project.key(),
            timestamp: now,
            sequence: 1,
            auditor,
            regulator,
            community_authority,
            metadata_hash,
            metadata_uri,
        });
        Ok(())
    }

    pub fn submit_evidence(
        ctx: Context<SubmitEvidence>,
        content_hash: [u8; 32],
        storage_uri: String,
        evidence_type: String,
        metadata_uri: String,
    ) -> Result<()> {
        validate_hash(&content_hash)?;
        validate_uri(&storage_uri)?;
        validate_uri(&metadata_uri)?;
        require!(
            !evidence_type.trim().is_empty(),
            GroundTruthError::EvidenceTypeRequired
        );
        require!(
            evidence_type.as_bytes().len() <= MAX_TYPE_LEN,
            GroundTruthError::StringTooLong
        );

        let now = Clock::get()?.unix_timestamp;
        let project = &mut ctx.accounts.project;
        let index = project.evidence_count;
        let evidence = &mut ctx.accounts.evidence;
        evidence.project = project.key();
        evidence.index = index;
        evidence.submitter = ctx.accounts.company.key();
        evidence.status = EvidenceStatus::Submitted;
        evidence.content_hash = content_hash;
        evidence.storage_uri = storage_uri.clone();
        evidence.evidence_type = evidence_type.clone();
        evidence.metadata_uri = metadata_uri;
        evidence.previous_evidence = None;
        evidence.submitted_at = now;
        project.latest_evidence = Some(evidence.key());
        project.evidence_count = checked_add_u64(project.evidence_count, 1)?;
        let sequence = project.next_sequence()?;

        emit!(EvidenceSubmitted {
            project: project.key(),
            actor: ctx.accounts.company.key(),
            record: evidence.key(),
            timestamp: now,
            sequence,
            index,
            content_hash,
            storage_uri,
            evidence_type,
        });
        Ok(())
    }

    pub fn reject_evidence(
        ctx: Context<DecideEvidence>,
        reason: String,
        supporting_hash: [u8; 32],
        supporting_uri: String,
    ) -> Result<()> {
        validate_reason(&reason)?;
        validate_hash(&supporting_hash)?;
        validate_uri(&supporting_uri)?;
        require!(
            ctx.accounts.evidence.is_decidable(),
            GroundTruthError::InvalidStateTransition
        );

        let now = Clock::get()?.unix_timestamp;
        let evidence = &mut ctx.accounts.evidence;
        evidence.status = EvidenceStatus::Rejected;
        let decision = &mut ctx.accounts.decision;
        decision.project = ctx.accounts.project.key();
        decision.evidence = evidence.key();
        decision.auditor = ctx.accounts.auditor.key();
        decision.approved = false;
        decision.reason = reason.clone();
        decision.supporting_hash = Some(supporting_hash);
        decision.supporting_uri = Some(supporting_uri.clone());
        decision.decided_at = now;
        let project = &mut ctx.accounts.project;
        let sequence = project.next_sequence()?;

        emit!(VerificationRejected {
            project: project.key(),
            actor: ctx.accounts.auditor.key(),
            record: decision.key(),
            timestamp: now,
            sequence,
            evidence: evidence.key(),
            reason,
            supporting_hash,
            supporting_uri,
        });
        Ok(())
    }

    pub fn verify_evidence(ctx: Context<DecideEvidence>) -> Result<()> {
        require!(
            ctx.accounts.evidence.is_decidable(),
            GroundTruthError::InvalidStateTransition
        );
        let now = Clock::get()?.unix_timestamp;
        let evidence = &mut ctx.accounts.evidence;
        evidence.status = EvidenceStatus::Verified;
        let decision = &mut ctx.accounts.decision;
        decision.project = ctx.accounts.project.key();
        decision.evidence = evidence.key();
        decision.auditor = ctx.accounts.auditor.key();
        decision.approved = true;
        decision.reason = String::new();
        decision.supporting_hash = None;
        decision.supporting_uri = None;
        decision.decided_at = now;
        let project = &mut ctx.accounts.project;
        project.latest_verified_evidence = Some(evidence.key());
        let sequence = project.next_sequence()?;

        emit!(EvidenceVerified {
            project: project.key(),
            actor: ctx.accounts.auditor.key(),
            record: decision.key(),
            timestamp: now,
            sequence,
            evidence: evidence.key(),
        });
        Ok(())
    }

    pub fn resubmit_evidence(
        ctx: Context<ResubmitEvidence>,
        content_hash: [u8; 32],
        storage_uri: String,
        evidence_type: String,
        metadata_uri: String,
    ) -> Result<()> {
        validate_hash(&content_hash)?;
        validate_uri(&storage_uri)?;
        validate_uri(&metadata_uri)?;
        require!(
            ctx.accounts.previous_evidence.status == EvidenceStatus::Rejected,
            GroundTruthError::InvalidStateTransition
        );
        require!(
            !evidence_type.trim().is_empty(),
            GroundTruthError::EvidenceTypeRequired
        );
        require!(
            evidence_type.as_bytes().len() <= MAX_TYPE_LEN,
            GroundTruthError::StringTooLong
        );

        let now = Clock::get()?.unix_timestamp;
        let project = &mut ctx.accounts.project;
        let index = project.evidence_count;
        let evidence = &mut ctx.accounts.evidence;
        evidence.project = project.key();
        evidence.index = index;
        evidence.submitter = ctx.accounts.company.key();
        evidence.status = EvidenceStatus::Resubmitted;
        evidence.content_hash = content_hash;
        evidence.storage_uri = storage_uri.clone();
        evidence.evidence_type = evidence_type;
        evidence.metadata_uri = metadata_uri;
        evidence.previous_evidence = Some(ctx.accounts.previous_evidence.key());
        evidence.submitted_at = now;
        project.latest_evidence = Some(evidence.key());
        project.evidence_count = checked_add_u64(project.evidence_count, 1)?;
        let sequence = project.next_sequence()?;

        emit!(EvidenceResubmitted {
            project: project.key(),
            actor: ctx.accounts.company.key(),
            record: evidence.key(),
            timestamp: now,
            sequence,
            rejected_evidence: ctx.accounts.previous_evidence.key(),
            new_evidence: evidence.key(),
            index,
            content_hash,
            storage_uri,
        });
        Ok(())
    }

    pub fn propose_liability_change(
        ctx: Context<ProposeLiability>,
        proposed_amount: u64,
        currency_code: [u8; 8],
        rationale_hash: [u8; 32],
        rationale_uri: String,
        previous_proposal: Option<Pubkey>,
    ) -> Result<()> {
        require!(proposed_amount > 0, GroundTruthError::InvalidAmount);
        validate_hash(&rationale_hash)?;
        validate_uri(&rationale_uri)?;
        require!(
            ctx.accounts.evidence.status == EvidenceStatus::Verified,
            GroundTruthError::EvidenceNotVerified
        );

        let now = Clock::get()?.unix_timestamp;
        let project = &mut ctx.accounts.project;
        let index = project.liability_proposal_count;
        let proposal = &mut ctx.accounts.proposal;
        proposal.project = project.key();
        proposal.index = index;
        proposal.verified_evidence = ctx.accounts.evidence.key();
        proposal.proposed_amount = proposed_amount;
        proposal.currency_code = currency_code;
        proposal.rationale_hash = rationale_hash;
        proposal.rationale_uri = rationale_uri;
        proposal.previous_proposal = previous_proposal;
        proposal.created_at = now;
        project.liability_proposal_count = checked_add_u64(project.liability_proposal_count, 1)?;
        let sequence = project.next_sequence()?;

        emit!(LiabilityProposed {
            project: project.key(),
            actor: ctx.accounts.company.key(),
            record: proposal.key(),
            timestamp: now,
            sequence,
            evidence: ctx.accounts.evidence.key(),
            amount: proposed_amount,
        });
        Ok(())
    }

    pub fn reject_liability_change(
        ctx: Context<RejectLiability>,
        reason: String,
        supporting_hash: [u8; 32],
        supporting_uri: String,
    ) -> Result<()> {
        validate_reason(&reason)?;
        validate_hash(&supporting_hash)?;
        validate_uri(&supporting_uri)?;
        let now = Clock::get()?.unix_timestamp;
        let decision = &mut ctx.accounts.decision;
        decision.project = ctx.accounts.project.key();
        decision.proposal = ctx.accounts.proposal.key();
        decision.regulator = ctx.accounts.regulator.key();
        decision.status = LiabilityStatus::Rejected;
        decision.approved_amount = 0;
        decision.liability_revision = ctx.accounts.project.current_liability_revision;
        decision.reason = reason.clone();
        decision.supporting_hash = Some(supporting_hash);
        decision.supporting_uri = Some(supporting_uri.clone());
        decision.decided_at = now;
        let project = &mut ctx.accounts.project;
        let sequence = project.next_sequence()?;

        emit!(LiabilityRejected {
            project: project.key(),
            actor: ctx.accounts.regulator.key(),
            record: decision.key(),
            timestamp: now,
            sequence,
            proposal: ctx.accounts.proposal.key(),
            reason,
            supporting_hash,
            supporting_uri,
        });
        Ok(())
    }

    pub fn approve_liability_change(ctx: Context<ApproveLiability>, reason: String) -> Result<()> {
        validate_reason(&reason)?;
        require!(
            ctx.accounts.evidence.status == EvidenceStatus::Verified,
            GroundTruthError::EvidenceNotVerified
        );
        require_keys_eq!(
            ctx.accounts.proposal.verified_evidence,
            ctx.accounts.evidence.key(),
            GroundTruthError::RecordProjectMismatch
        );
        require!(
            ctx.accounts.project.outstanding_correction_count == 0,
            GroundTruthError::OutstandingCorrectionRequired
        );

        let now = Clock::get()?.unix_timestamp;
        let project = &mut ctx.accounts.project;
        let revision = checked_add_u64(project.current_liability_revision, 1)?;
        let amount = ctx.accounts.proposal.proposed_amount;
        let decision = &mut ctx.accounts.decision;
        decision.project = project.key();
        decision.proposal = ctx.accounts.proposal.key();
        decision.regulator = ctx.accounts.regulator.key();
        decision.status = LiabilityStatus::Approved;
        decision.approved_amount = amount;
        decision.liability_revision = revision;
        decision.reason = reason;
        decision.supporting_hash = None;
        decision.supporting_uri = None;
        decision.decided_at = now;
        project.current_approved_liability = amount;
        project.current_liability_revision = revision;
        project.latest_liability_decision = Some(decision.key());
        let sequence = project.next_sequence()?;

        let bond = &mut ctx.accounts.bond;
        bond.required_amount = amount;
        bond.liability_revision = revision;
        bond.status = if bond.deposited_amount >= amount {
            BondStatus::Funded
        } else {
            BondStatus::Unfunded
        };
        bond.last_updated_at = now;

        emit!(LiabilityApproved {
            project: project.key(),
            actor: ctx.accounts.regulator.key(),
            record: decision.key(),
            timestamp: now,
            sequence,
            proposal: ctx.accounts.proposal.key(),
            amount,
            revision,
        });
        Ok(())
    }

    pub fn deposit_bond(ctx: Context<DepositBond>, amount: u64) -> Result<()> {
        require!(amount > 0, GroundTruthError::InvalidAmount);
        require!(
            ctx.accounts.project.current_approved_liability > 0,
            GroundTruthError::LiabilityNotApproved
        );
        let cpi_accounts = Transfer {
            from: ctx.accounts.company_token.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.company.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts),
            amount,
        )?;
        ctx.accounts.vault.reload()?;
        let now = Clock::get()?.unix_timestamp;
        let bond = &mut ctx.accounts.bond;
        bond.deposited_amount = ctx.accounts.vault.amount;
        if !bond.release_paused && bond.deposited_amount >= bond.required_amount {
            bond.status = BondStatus::Funded;
        }
        bond.last_updated_at = now;
        let project = &mut ctx.accounts.project;
        let sequence = project.next_sequence()?;
        emit!(BondDeposited {
            project: project.key(),
            actor: ctx.accounts.company.key(),
            record: bond.key(),
            timestamp: now,
            sequence,
            mint: bond.token_mint,
            amount,
            total_deposited: bond.deposited_amount,
            vault: ctx.accounts.vault.key(),
        });
        Ok(())
    }

    pub fn open_dispute(
        ctx: Context<OpenDispute>,
        reason: String,
        supporting_hash: [u8; 32],
        supporting_uri: String,
    ) -> Result<()> {
        validate_reason(&reason)?;
        validate_hash(&supporting_hash)?;
        validate_uri(&supporting_uri)?;
        require!(
            ctx.accounts.bond.status != BondStatus::Released,
            GroundTruthError::BondAlreadyReleased
        );
        require!(
            ctx.accounts.target_decision.status == LiabilityStatus::Approved,
            GroundTruthError::InvalidDisputeTarget
        );
        require!(
            ctx.accounts.project.latest_liability_decision
                == Some(ctx.accounts.target_decision.key()),
            GroundTruthError::InvalidDisputeTarget
        );

        let now = Clock::get()?.unix_timestamp;
        let project = &mut ctx.accounts.project;
        let index = project.dispute_count;
        let dispute = &mut ctx.accounts.dispute;
        dispute.project = project.key();
        dispute.index = index;
        dispute.opened_by = ctx.accounts.community_authority.key();
        dispute.status = DisputeStatus::Open;
        dispute.reason = reason.clone();
        dispute.supporting_hash = supporting_hash;
        dispute.supporting_uri = supporting_uri.clone();
        dispute.target_record = ctx.accounts.target_decision.key();
        dispute.opened_at = now;
        dispute.resolved_at = None;
        dispute.resolution = None;
        project.dispute_count = checked_add_u64(project.dispute_count, 1)?;
        project.active_dispute_count = checked_add_u32(project.active_dispute_count, 1)?;
        let sequence = project.next_sequence()?;
        let bond = &mut ctx.accounts.bond;
        bond.release_paused = true;
        bond.status = BondStatus::ReleasePaused;
        bond.last_updated_at = now;

        emit!(DisputeOpened {
            project: project.key(),
            actor: ctx.accounts.community_authority.key(),
            record: dispute.key(),
            timestamp: now,
            sequence,
            target: dispute.target_record,
            reason,
            supporting_hash,
            supporting_uri,
            active_dispute_count: project.active_dispute_count,
        });
        emit!(BondReleasePaused {
            project: project.key(),
            actor: ctx.accounts.community_authority.key(),
            record: bond.key(),
            timestamp: now,
            sequence,
            dispute: dispute.key(),
            active_dispute_count: project.active_dispute_count,
        });
        Ok(())
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        outcome: ResolutionOutcome,
        reason: String,
        supporting_hash: Option<[u8; 32]>,
        supporting_uri: Option<String>,
        requires_correction: bool,
    ) -> Result<()> {
        validate_reason(&reason)?;
        if let Some(hash) = supporting_hash.as_ref() {
            validate_hash(hash)?;
        }
        if let Some(uri) = supporting_uri.as_ref() {
            validate_uri(uri)?;
        }
        require!(
            ctx.accounts.dispute.status == DisputeStatus::Open,
            GroundTruthError::AlreadyResolved
        );

        let now = Clock::get()?.unix_timestamp;
        let dispute = &mut ctx.accounts.dispute;
        dispute.status = DisputeStatus::Resolved;
        dispute.resolved_at = Some(now);
        dispute.resolution = Some(ctx.accounts.resolution.key());
        let resolution = &mut ctx.accounts.resolution;
        resolution.project = ctx.accounts.project.key();
        resolution.dispute = dispute.key();
        resolution.target_record = dispute.target_record;
        resolution.regulator = ctx.accounts.regulator.key();
        resolution.outcome = outcome;
        resolution.reason = reason;
        resolution.supporting_hash = supporting_hash;
        resolution.supporting_uri = supporting_uri;
        resolution.requires_correction = requires_correction;
        resolution.correction_satisfied = false;
        resolution.resolved_at = now;

        let project = &mut ctx.accounts.project;
        project.active_dispute_count = project
            .active_dispute_count
            .checked_sub(1)
            .ok_or(GroundTruthError::CounterUnderflow)?;
        if requires_correction {
            project.outstanding_correction_count =
                checked_add_u32(project.outstanding_correction_count, 1)?;
        }
        let sequence = project.next_sequence()?;
        let bond = &mut ctx.accounts.bond;
        bond.release_paused =
            project.active_dispute_count > 0 || project.outstanding_correction_count > 0;
        bond.status = if bond.release_paused {
            BondStatus::ReleasePaused
        } else {
            BondStatus::Funded
        };
        bond.last_updated_at = now;

        emit!(DisputeResolved {
            project: project.key(),
            actor: ctx.accounts.regulator.key(),
            record: resolution.key(),
            timestamp: now,
            sequence,
            dispute: dispute.key(),
            outcome,
            requires_correction,
            remaining_active_count: project.active_dispute_count,
        });
        if !bond.release_paused {
            emit!(BondReleaseResumed {
                project: project.key(),
                actor: ctx.accounts.regulator.key(),
                record: bond.key(),
                timestamp: now,
                sequence,
                cleared_by: resolution.key(),
                revision: project.current_liability_revision,
            });
        }
        Ok(())
    }

    pub fn append_liability_correction(
        ctx: Context<AppendCorrection>,
        correction_type: CorrectionType,
        reason: String,
        supporting_hash: Option<[u8; 32]>,
        supporting_uri: Option<String>,
        corrected_amount: Option<u64>,
        expected_correction_head: Option<Pubkey>,
    ) -> Result<()> {
        validate_reason(&reason)?;
        if let Some(hash) = supporting_hash.as_ref() {
            validate_hash(hash)?;
        }
        if let Some(uri) = supporting_uri.as_ref() {
            validate_uri(uri)?;
        }
        require!(
            ctx.accounts.project.latest_correction == expected_correction_head,
            GroundTruthError::StaleCorrectionHead
        );
        require!(
            ctx.accounts.resolution.requires_correction
                && !ctx.accounts.resolution.correction_satisfied,
            GroundTruthError::OutstandingCorrectionRequired
        );
        require_keys_eq!(
            ctx.accounts.resolution.target_record,
            ctx.accounts.target_decision.key(),
            GroundTruthError::RecordProjectMismatch
        );
        match correction_type {
            CorrectionType::Corrected => require!(
                corrected_amount.unwrap_or(0) > 0,
                GroundTruthError::InvalidAmount
            ),
            CorrectionType::Reaffirmed => {
                require!(corrected_amount.is_none(), GroundTruthError::InvalidAmount)
            }
        }

        let now = Clock::get()?.unix_timestamp;
        let project = &mut ctx.accounts.project;
        let index = project.correction_count;
        let resulting_amount = corrected_amount.unwrap_or(project.current_approved_liability);
        let revision = checked_add_u64(project.current_liability_revision, 1)?;
        let correction = &mut ctx.accounts.correction;
        correction.project = project.key();
        correction.index = index;
        correction.author = ctx.accounts.regulator.key();
        correction.target_record = ctx.accounts.target_decision.key();
        correction.resolution = ctx.accounts.resolution.key();
        correction.correction_type = correction_type;
        correction.reason = reason;
        correction.supporting_hash = supporting_hash;
        correction.supporting_uri = supporting_uri;
        correction.corrected_liability_amount = corrected_amount;
        correction.resulting_liability_revision = revision;
        correction.previous_correction = expected_correction_head;
        correction.created_at = now;

        ctx.accounts.resolution.correction_satisfied = true;
        project.outstanding_correction_count = project
            .outstanding_correction_count
            .checked_sub(1)
            .ok_or(GroundTruthError::CounterUnderflow)?;
        project.current_approved_liability = resulting_amount;
        project.current_liability_revision = revision;
        project.latest_correction = Some(correction.key());
        project.correction_count = checked_add_u64(project.correction_count, 1)?;
        let sequence = project.next_sequence()?;

        let bond = &mut ctx.accounts.bond;
        bond.required_amount = resulting_amount;
        bond.liability_revision = revision;
        bond.release_paused =
            project.active_dispute_count > 0 || project.outstanding_correction_count > 0;
        bond.status = if bond.release_paused {
            BondStatus::ReleasePaused
        } else if bond.deposited_amount >= resulting_amount {
            BondStatus::ReleaseReady
        } else {
            BondStatus::Unfunded
        };
        bond.last_updated_at = now;

        emit!(CorrectionAppended {
            project: project.key(),
            actor: ctx.accounts.regulator.key(),
            record: correction.key(),
            timestamp: now,
            sequence,
            target: ctx.accounts.target_decision.key(),
            correction_type,
            resulting_amount,
            resulting_revision: revision,
        });
        if !bond.release_paused && bond.status == BondStatus::ReleaseReady {
            emit!(BondReleaseResumed {
                project: project.key(),
                actor: ctx.accounts.regulator.key(),
                record: bond.key(),
                timestamp: now,
                sequence,
                cleared_by: correction.key(),
                revision,
            });
        }
        Ok(())
    }

    pub fn release_bond(ctx: Context<ReleaseBond>) -> Result<()> {
        validate_release_state(
            &ctx.accounts.project,
            &ctx.accounts.bond,
            &ctx.accounts.latest_decision,
            ctx.accounts.latest_decision.key(),
            ctx.accounts.vault.amount,
        )?;

        let amount = ctx.accounts.bond.required_amount;
        let project_key = ctx.accounts.project.key();
        let bump = [ctx.accounts.bond.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[b"bond", project_key.as_ref(), &bump]];
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.recipient_token.to_account_info(),
            authority: ctx.accounts.bond.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                cpi_accounts,
                signer_seeds,
            ),
            amount,
        )?;
        ctx.accounts.vault.reload()?;

        let now = Clock::get()?.unix_timestamp;
        let bond = &mut ctx.accounts.bond;
        bond.released_amount = checked_add_u64(bond.released_amount, amount)?;
        bond.deposited_amount = ctx.accounts.vault.amount;
        bond.status = BondStatus::Released;
        bond.last_updated_at = now;
        let project = &mut ctx.accounts.project;
        let sequence = project.next_sequence()?;
        emit!(BondReleased {
            project: project.key(),
            actor: ctx.accounts.regulator.key(),
            record: bond.key(),
            timestamp: now,
            sequence,
            mint: bond.token_mint,
            amount,
            recipient: bond.release_recipient,
            total_released: bond.released_amount,
            revision: bond.liability_revision,
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(project_id: [u8; 32])]
pub struct CreateProject<'info> {
    #[account(mut)]
    pub company: Signer<'info>,
    #[account(init, payer = company, space = 8 + Project::INIT_SPACE, seeds = [b"project", company.key().as_ref(), project_id.as_ref()], bump)]
    pub project: Account<'info, Project>,
    #[account(init, payer = company, space = 8 + BondEscrow::INIT_SPACE, seeds = [b"bond", project.key().as_ref()], bump)]
    pub bond: Account<'info, BondEscrow>,
    pub token_mint: Account<'info, Mint>,
    #[account(init, payer = company, associated_token::mint = token_mint, associated_token::authority = bond)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitEvidence<'info> {
    #[account(mut, has_one = company @ GroundTruthError::UnauthorizedRole)]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub company: Signer<'info>,
    #[account(init, payer = company, space = 8 + EvidenceRecord::INIT_SPACE, seeds = [b"evidence", project.key().as_ref(), &project.evidence_count.to_le_bytes()], bump)]
    pub evidence: Account<'info, EvidenceRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DecideEvidence<'info> {
    #[account(mut, has_one = auditor @ GroundTruthError::UnauthorizedRole)]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub auditor: Signer<'info>,
    #[account(mut, has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub evidence: Account<'info, EvidenceRecord>,
    #[account(init, payer = auditor, space = 8 + VerificationDecision::INIT_SPACE, seeds = [b"verification", evidence.key().as_ref()], bump)]
    pub decision: Account<'info, VerificationDecision>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResubmitEvidence<'info> {
    #[account(mut, has_one = company @ GroundTruthError::UnauthorizedRole)]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub company: Signer<'info>,
    #[account(has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub previous_evidence: Account<'info, EvidenceRecord>,
    #[account(init, payer = company, space = 8 + EvidenceRecord::INIT_SPACE, seeds = [b"evidence", project.key().as_ref(), &project.evidence_count.to_le_bytes()], bump)]
    pub evidence: Account<'info, EvidenceRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProposeLiability<'info> {
    #[account(mut, has_one = company @ GroundTruthError::UnauthorizedRole)]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub company: Signer<'info>,
    #[account(has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub evidence: Account<'info, EvidenceRecord>,
    #[account(init, payer = company, space = 8 + LiabilityProposal::INIT_SPACE, seeds = [b"liability_proposal", project.key().as_ref(), &project.liability_proposal_count.to_le_bytes()], bump)]
    pub proposal: Account<'info, LiabilityProposal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RejectLiability<'info> {
    #[account(mut, has_one = regulator @ GroundTruthError::UnauthorizedRole)]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub regulator: Signer<'info>,
    #[account(has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub proposal: Account<'info, LiabilityProposal>,
    #[account(init, payer = regulator, space = 8 + LiabilityDecision::INIT_SPACE, seeds = [b"liability_decision", proposal.key().as_ref()], bump)]
    pub decision: Account<'info, LiabilityDecision>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveLiability<'info> {
    #[account(mut, has_one = regulator @ GroundTruthError::UnauthorizedRole)]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub regulator: Signer<'info>,
    #[account(has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub proposal: Account<'info, LiabilityProposal>,
    #[account(has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub evidence: Account<'info, EvidenceRecord>,
    #[account(init, payer = regulator, space = 8 + LiabilityDecision::INIT_SPACE, seeds = [b"liability_decision", proposal.key().as_ref()], bump)]
    pub decision: Account<'info, LiabilityDecision>,
    #[account(mut, seeds = [b"bond", project.key().as_ref()], bump = bond.bump, has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub bond: Account<'info, BondEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositBond<'info> {
    #[account(mut, has_one = company @ GroundTruthError::UnauthorizedRole)]
    pub project: Account<'info, Project>,
    pub company: Signer<'info>,
    #[account(mut, seeds = [b"bond", project.key().as_ref()], bump = bond.bump, has_one = project @ GroundTruthError::RecordProjectMismatch, has_one = vault @ GroundTruthError::InvalidVault)]
    pub bond: Account<'info, BondEscrow>,
    #[account(mut, constraint = company_token.owner == company.key() @ GroundTruthError::UnauthorizedRole, constraint = company_token.mint == bond.token_mint @ GroundTruthError::InvalidTokenMint)]
    pub company_token: Account<'info, TokenAccount>,
    #[account(mut, constraint = vault.mint == bond.token_mint @ GroundTruthError::InvalidTokenMint, constraint = vault.owner == bond.key() @ GroundTruthError::InvalidVault)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    #[account(mut, has_one = community_authority @ GroundTruthError::UnauthorizedRole)]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub community_authority: Signer<'info>,
    #[account(has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub target_decision: Account<'info, LiabilityDecision>,
    #[account(init, payer = community_authority, space = 8 + DisputeRecord::INIT_SPACE, seeds = [b"dispute", project.key().as_ref(), &project.dispute_count.to_le_bytes()], bump)]
    pub dispute: Account<'info, DisputeRecord>,
    #[account(mut, seeds = [b"bond", project.key().as_ref()], bump = bond.bump, has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub bond: Account<'info, BondEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut, has_one = regulator @ GroundTruthError::UnauthorizedRole)]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub regulator: Signer<'info>,
    #[account(mut, has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub dispute: Account<'info, DisputeRecord>,
    #[account(init, payer = regulator, space = 8 + DisputeResolution::INIT_SPACE, seeds = [b"resolution", dispute.key().as_ref()], bump)]
    pub resolution: Account<'info, DisputeResolution>,
    #[account(mut, seeds = [b"bond", project.key().as_ref()], bump = bond.bump, has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub bond: Account<'info, BondEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AppendCorrection<'info> {
    #[account(mut, has_one = regulator @ GroundTruthError::UnauthorizedRole)]
    pub project: Box<Account<'info, Project>>,
    #[account(mut)]
    pub regulator: Signer<'info>,
    #[account(has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub target_decision: Box<Account<'info, LiabilityDecision>>,
    #[account(mut, has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub resolution: Box<Account<'info, DisputeResolution>>,
    #[account(init, payer = regulator, space = 8 + CorrectionRecord::INIT_SPACE, seeds = [b"correction", project.key().as_ref(), &project.correction_count.to_le_bytes()], bump)]
    pub correction: Box<Account<'info, CorrectionRecord>>,
    #[account(mut, seeds = [b"bond", project.key().as_ref()], bump = bond.bump, has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub bond: Box<Account<'info, BondEscrow>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseBond<'info> {
    #[account(mut, has_one = regulator @ GroundTruthError::UnauthorizedRole)]
    pub project: Box<Account<'info, Project>>,
    pub regulator: Signer<'info>,
    #[account(has_one = project @ GroundTruthError::RecordProjectMismatch)]
    pub latest_decision: Box<Account<'info, LiabilityDecision>>,
    #[account(mut, seeds = [b"bond", project.key().as_ref()], bump = bond.bump, has_one = project @ GroundTruthError::RecordProjectMismatch, has_one = vault @ GroundTruthError::InvalidVault)]
    pub bond: Box<Account<'info, BondEscrow>>,
    #[account(mut, constraint = vault.mint == bond.token_mint @ GroundTruthError::InvalidTokenMint, constraint = vault.owner == bond.key() @ GroundTruthError::InvalidVault)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = recipient_token.mint == bond.token_mint @ GroundTruthError::InvalidTokenMint, constraint = recipient_token.owner == bond.release_recipient @ GroundTruthError::InvalidReleaseRecipient)]
    pub recipient_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct Project {
    pub bump: u8,
    pub project_id: [u8; 32],
    pub company: Pubkey,
    pub auditor: Pubkey,
    pub regulator: Pubkey,
    pub community_authority: Pubkey,
    pub financial_observer: Option<Pubkey>,
    pub metadata_hash: [u8; 32],
    #[max_len(200)]
    pub metadata_uri: String,
    pub latest_evidence: Option<Pubkey>,
    pub latest_verified_evidence: Option<Pubkey>,
    pub latest_liability_decision: Option<Pubkey>,
    pub latest_correction: Option<Pubkey>,
    pub evidence_count: u64,
    pub liability_proposal_count: u64,
    pub dispute_count: u64,
    pub correction_count: u64,
    pub event_sequence: u64,
    pub active_dispute_count: u32,
    pub outstanding_correction_count: u32,
    pub current_approved_liability: u64,
    pub current_liability_revision: u64,
    pub created_at: i64,
}

impl Project {
    fn next_sequence(&mut self) -> Result<u64> {
        self.event_sequence = checked_add_u64(self.event_sequence, 1)?;
        Ok(self.event_sequence)
    }
}

#[account]
#[derive(InitSpace)]
pub struct EvidenceRecord {
    pub project: Pubkey,
    pub index: u64,
    pub submitter: Pubkey,
    pub status: EvidenceStatus,
    pub content_hash: [u8; 32],
    #[max_len(200)]
    pub storage_uri: String,
    #[max_len(48)]
    pub evidence_type: String,
    #[max_len(200)]
    pub metadata_uri: String,
    pub previous_evidence: Option<Pubkey>,
    pub submitted_at: i64,
}
impl EvidenceRecord {
    fn is_decidable(&self) -> bool {
        matches!(
            self.status,
            EvidenceStatus::Submitted | EvidenceStatus::Resubmitted
        )
    }
}

#[account]
#[derive(InitSpace)]
pub struct VerificationDecision {
    pub project: Pubkey,
    pub evidence: Pubkey,
    pub auditor: Pubkey,
    pub approved: bool,
    #[max_len(500)]
    pub reason: String,
    pub supporting_hash: Option<[u8; 32]>,
    #[max_len(200)]
    pub supporting_uri: Option<String>,
    pub decided_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct LiabilityProposal {
    pub project: Pubkey,
    pub index: u64,
    pub verified_evidence: Pubkey,
    pub proposed_amount: u64,
    pub currency_code: [u8; 8],
    pub rationale_hash: [u8; 32],
    #[max_len(200)]
    pub rationale_uri: String,
    pub previous_proposal: Option<Pubkey>,
    pub created_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct LiabilityDecision {
    pub project: Pubkey,
    pub proposal: Pubkey,
    pub regulator: Pubkey,
    pub status: LiabilityStatus,
    pub approved_amount: u64,
    pub liability_revision: u64,
    #[max_len(500)]
    pub reason: String,
    pub supporting_hash: Option<[u8; 32]>,
    #[max_len(200)]
    pub supporting_uri: Option<String>,
    pub decided_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct DisputeRecord {
    pub project: Pubkey,
    pub index: u64,
    pub opened_by: Pubkey,
    pub status: DisputeStatus,
    #[max_len(500)]
    pub reason: String,
    pub supporting_hash: [u8; 32],
    #[max_len(200)]
    pub supporting_uri: String,
    pub target_record: Pubkey,
    pub opened_at: i64,
    pub resolved_at: Option<i64>,
    pub resolution: Option<Pubkey>,
}

#[account]
#[derive(InitSpace)]
pub struct DisputeResolution {
    pub project: Pubkey,
    pub dispute: Pubkey,
    pub target_record: Pubkey,
    pub regulator: Pubkey,
    pub outcome: ResolutionOutcome,
    #[max_len(500)]
    pub reason: String,
    pub supporting_hash: Option<[u8; 32]>,
    #[max_len(200)]
    pub supporting_uri: Option<String>,
    pub requires_correction: bool,
    pub correction_satisfied: bool,
    pub resolved_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct CorrectionRecord {
    pub project: Pubkey,
    pub index: u64,
    pub author: Pubkey,
    pub target_record: Pubkey,
    pub resolution: Pubkey,
    pub correction_type: CorrectionType,
    #[max_len(500)]
    pub reason: String,
    pub supporting_hash: Option<[u8; 32]>,
    #[max_len(200)]
    pub supporting_uri: Option<String>,
    pub corrected_liability_amount: Option<u64>,
    pub resulting_liability_revision: u64,
    pub previous_correction: Option<Pubkey>,
    pub created_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct BondEscrow {
    pub project: Pubkey,
    pub bump: u8,
    pub token_mint: Pubkey,
    pub vault: Pubkey,
    pub deposited_amount: u64,
    pub released_amount: u64,
    pub required_amount: u64,
    pub liability_revision: u64,
    pub status: BondStatus,
    pub release_paused: bool,
    pub release_recipient: Pubkey,
    pub last_updated_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum EvidenceStatus {
    Submitted,
    Resubmitted,
    Rejected,
    Verified,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum LiabilityStatus {
    Rejected,
    Approved,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum DisputeStatus {
    Open,
    Resolved,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum BondStatus {
    Unfunded,
    Funded,
    ReleasePaused,
    ReleaseReady,
    Released,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum ResolutionOutcome {
    Upheld,
    Dismissed,
    RemediationRequired,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum CorrectionType {
    Corrected,
    Reaffirmed,
}

#[event]
pub struct ProjectCreated {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub auditor: Pubkey,
    pub regulator: Pubkey,
    pub community_authority: Pubkey,
    pub metadata_hash: [u8; 32],
    pub metadata_uri: String,
}
#[event]
pub struct EvidenceSubmitted {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub index: u64,
    pub content_hash: [u8; 32],
    pub storage_uri: String,
    pub evidence_type: String,
}
#[event]
pub struct EvidenceResubmitted {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub rejected_evidence: Pubkey,
    pub new_evidence: Pubkey,
    pub index: u64,
    pub content_hash: [u8; 32],
    pub storage_uri: String,
}
#[event]
pub struct VerificationRejected {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub evidence: Pubkey,
    pub reason: String,
    pub supporting_hash: [u8; 32],
    pub supporting_uri: String,
}
#[event]
pub struct EvidenceVerified {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub evidence: Pubkey,
}
#[event]
pub struct LiabilityProposed {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub evidence: Pubkey,
    pub amount: u64,
}
#[event]
pub struct LiabilityApproved {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub proposal: Pubkey,
    pub amount: u64,
    pub revision: u64,
}
#[event]
pub struct LiabilityRejected {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub proposal: Pubkey,
    pub reason: String,
    pub supporting_hash: [u8; 32],
    pub supporting_uri: String,
}
#[event]
pub struct BondDeposited {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub mint: Pubkey,
    pub amount: u64,
    pub total_deposited: u64,
    pub vault: Pubkey,
}
#[event]
pub struct DisputeOpened {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub target: Pubkey,
    pub reason: String,
    pub supporting_hash: [u8; 32],
    pub supporting_uri: String,
    pub active_dispute_count: u32,
}
#[event]
pub struct BondReleasePaused {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub dispute: Pubkey,
    pub active_dispute_count: u32,
}
#[event]
pub struct DisputeResolved {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub dispute: Pubkey,
    pub outcome: ResolutionOutcome,
    pub requires_correction: bool,
    pub remaining_active_count: u32,
}
#[event]
pub struct BondReleaseResumed {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub cleared_by: Pubkey,
    pub revision: u64,
}
#[event]
pub struct CorrectionAppended {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub target: Pubkey,
    pub correction_type: CorrectionType,
    pub resulting_amount: u64,
    pub resulting_revision: u64,
}
#[event]
pub struct BondReleased {
    pub project: Pubkey,
    pub actor: Pubkey,
    pub record: Pubkey,
    pub timestamp: i64,
    pub sequence: u64,
    pub mint: Pubkey,
    pub amount: u64,
    pub recipient: Pubkey,
    pub total_released: u64,
    pub revision: u64,
}

#[error_code]
pub enum GroundTruthError {
    #[msg("This wallet is not authorized for the requested role.")]
    UnauthorizedRole,
    #[msg("The requested state transition is not allowed.")]
    InvalidStateTransition,
    #[msg("The supplied record belongs to a different project.")]
    RecordProjectMismatch,
    #[msg("A rejection or resolution reason is required.")]
    ReasonRequired,
    #[msg("A supporting evidence reference is required.")]
    EvidenceReferenceRequired,
    #[msg("The supplied SHA-256 hash is invalid.")]
    InvalidHash,
    #[msg("The supplied storage URI is invalid.")]
    InvalidUri,
    #[msg("A supplied string exceeds its bounded on-chain length.")]
    StringTooLong,
    #[msg("An evidence type is required.")]
    EvidenceTypeRequired,
    #[msg("Configured project roles must use distinct wallets.")]
    RolesMustBeDistinct,
    #[msg("The evidence has not been verified.")]
    EvidenceNotVerified,
    #[msg("An active dispute blocks bond release.")]
    ActiveDisputeExists,
    #[msg("Bond release is paused.")]
    ReleaseIsPaused,
    #[msg("A required correction has not been appended.")]
    OutstandingCorrectionRequired,
    #[msg("No approved liability exists.")]
    LiabilityNotApproved,
    #[msg("The liability revision does not match the current project revision.")]
    LiabilityRevisionMismatch,
    #[msg("The escrow vault does not have enough tokens.")]
    InsufficientBondBalance,
    #[msg("The token vault is invalid.")]
    InvalidVault,
    #[msg("The token mint is invalid.")]
    InvalidTokenMint,
    #[msg("The release recipient is invalid.")]
    InvalidReleaseRecipient,
    #[msg("This dispute has already been resolved.")]
    AlreadyResolved,
    #[msg("A counter would underflow.")]
    CounterUnderflow,
    #[msg("An arithmetic operation overflowed.")]
    ArithmeticOverflow,
    #[msg("The supplied correction head is stale.")]
    StaleCorrectionHead,
    #[msg("The bond has already been released.")]
    BondAlreadyReleased,
    #[msg("The amount must be greater than zero and valid for this action.")]
    InvalidAmount,
    #[msg("The dispute target is not the current approved liability decision.")]
    InvalidDisputeTarget,
}

fn validate_release_state(
    project: &Project,
    bond: &BondEscrow,
    latest_decision: &LiabilityDecision,
    latest_decision_key: Pubkey,
    vault_amount: u64,
) -> Result<()> {
    require!(
        bond.status != BondStatus::Released,
        GroundTruthError::BondAlreadyReleased
    );
    require!(
        project.current_approved_liability > 0,
        GroundTruthError::LiabilityNotApproved
    );
    require!(
        latest_decision.status == LiabilityStatus::Approved,
        GroundTruthError::LiabilityNotApproved
    );
    require!(
        project.latest_liability_decision == Some(latest_decision_key),
        GroundTruthError::LiabilityRevisionMismatch
    );
    require!(
        project.active_dispute_count == 0,
        GroundTruthError::ActiveDisputeExists
    );
    require!(
        project.outstanding_correction_count == 0,
        GroundTruthError::OutstandingCorrectionRequired
    );
    require!(!bond.release_paused, GroundTruthError::ReleaseIsPaused);
    require!(
        bond.status == BondStatus::Funded || bond.status == BondStatus::ReleaseReady,
        GroundTruthError::InvalidStateTransition
    );
    require!(
        bond.liability_revision == project.current_liability_revision,
        GroundTruthError::LiabilityRevisionMismatch
    );
    require!(
        bond.required_amount == project.current_approved_liability,
        GroundTruthError::LiabilityRevisionMismatch
    );
    require!(bond.required_amount > 0, GroundTruthError::InvalidAmount);
    require!(
        vault_amount >= bond.required_amount,
        GroundTruthError::InsufficientBondBalance
    );
    Ok(())
}

fn validate_hash(hash: &[u8; 32]) -> Result<()> {
    require!(*hash != [0u8; 32], GroundTruthError::InvalidHash);
    Ok(())
}
fn validate_uri(uri: &str) -> Result<()> {
    require!(
        !uri.trim().is_empty(),
        GroundTruthError::EvidenceReferenceRequired
    );
    require!(
        uri.as_bytes().len() <= MAX_URI_LEN,
        GroundTruthError::StringTooLong
    );
    Ok(())
}
fn validate_reason(reason: &str) -> Result<()> {
    require!(!reason.trim().is_empty(), GroundTruthError::ReasonRequired);
    require!(
        reason.as_bytes().len() <= MAX_REASON_LEN,
        GroundTruthError::StringTooLong
    );
    Ok(())
}
fn checked_add_u64(value: u64, increment: u64) -> Result<u64> {
    value
        .checked_add(increment)
        .ok_or_else(|| error!(GroundTruthError::ArithmeticOverflow))
}
fn checked_add_u32(value: u32, increment: u32) -> Result<u32> {
    value
        .checked_add(increment)
        .ok_or_else(|| error!(GroundTruthError::ArithmeticOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release_fixture() -> (Project, BondEscrow, LiabilityDecision, Pubkey) {
        let project_key = Pubkey::from([1u8; 32]);
        let decision_key = Pubkey::from([2u8; 32]);
        let project = Project {
            bump: 1,
            project_id: [9u8; 32],
            company: Pubkey::from([3u8; 32]),
            auditor: Pubkey::from([4u8; 32]),
            regulator: Pubkey::from([5u8; 32]),
            community_authority: Pubkey::from([6u8; 32]),
            financial_observer: None,
            metadata_hash: [7u8; 32],
            metadata_uri: "ipfs://project".into(),
            latest_evidence: None,
            latest_verified_evidence: None,
            latest_liability_decision: Some(decision_key),
            latest_correction: None,
            evidence_count: 0,
            liability_proposal_count: 0,
            dispute_count: 0,
            correction_count: 0,
            event_sequence: 1,
            active_dispute_count: 0,
            outstanding_correction_count: 0,
            current_approved_liability: 125_000,
            current_liability_revision: 3,
            created_at: 0,
        };
        let bond = BondEscrow {
            project: project_key,
            bump: 1,
            token_mint: Pubkey::from([8u8; 32]),
            vault: Pubkey::from([10u8; 32]),
            deposited_amount: 125_000,
            released_amount: 0,
            required_amount: 125_000,
            liability_revision: 3,
            status: BondStatus::ReleaseReady,
            release_paused: false,
            release_recipient: Pubkey::from([11u8; 32]),
            last_updated_at: 0,
        };
        let decision = LiabilityDecision {
            project: project_key,
            proposal: Pubkey::from([12u8; 32]),
            regulator: project.regulator,
            status: LiabilityStatus::Approved,
            approved_amount: 125_000,
            liability_revision: 3,
            reason: "Approved".into(),
            supporting_hash: None,
            supporting_uri: None,
            decided_at: 0,
        };
        (project, bond, decision, decision_key)
    }

    #[test]
    fn release_passes_only_when_every_guard_is_clear() {
        let (project, bond, decision, decision_key) = release_fixture();
        assert!(validate_release_state(&project, &bond, &decision, decision_key, 125_000).is_ok());
    }

    #[test]
    fn active_dispute_blocks_release() {
        let (mut project, mut bond, decision, decision_key) = release_fixture();
        project.active_dispute_count = 1;
        bond.release_paused = true;
        bond.status = BondStatus::ReleasePaused;
        let error = validate_release_state(&project, &bond, &decision, decision_key, 125_000)
            .unwrap_err()
            .to_string();
        assert!(error.contains("active dispute"));
    }

    #[test]
    fn outstanding_correction_blocks_release_after_resolution() {
        let (mut project, mut bond, decision, decision_key) = release_fixture();
        project.outstanding_correction_count = 1;
        bond.release_paused = true;
        bond.status = BondStatus::ReleasePaused;
        let error = validate_release_state(&project, &bond, &decision, decision_key, 125_000)
            .unwrap_err()
            .to_string();
        assert!(error.contains("required correction"));
    }

    #[test]
    fn stale_revision_and_insufficient_vault_are_rejected() {
        let (project, mut bond, decision, decision_key) = release_fixture();
        bond.liability_revision = 2;
        assert!(validate_release_state(&project, &bond, &decision, decision_key, 125_000).is_err());
        bond.liability_revision = 3;
        assert!(validate_release_state(&project, &bond, &decision, decision_key, 124_999).is_err());
    }

    #[test]
    fn evidence_decision_and_arithmetic_guards_are_deterministic() {
        let mut evidence = EvidenceRecord {
            project: Pubkey::default(),
            index: 0,
            submitter: Pubkey::default(),
            status: EvidenceStatus::Submitted,
            content_hash: [1u8; 32],
            storage_uri: "ipfs://evidence".into(),
            evidence_type: "drone".into(),
            metadata_uri: "ipfs://metadata".into(),
            previous_evidence: None,
            submitted_at: 0,
        };
        assert!(evidence.is_decidable());
        evidence.status = EvidenceStatus::Rejected;
        assert!(!evidence.is_decidable());
        assert!(checked_add_u64(u64::MAX, 1).is_err());
        assert!(checked_add_u32(u32::MAX, 1).is_err());
    }
}
