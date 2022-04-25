(use-trait sip-010-token .sip-010-trait-ft-standard.sip-010-trait)

(define-constant CONTRACT_ADDRESS (as-contract tx-sender))
(define-constant ERR_INVALID_START_BLOCK (err u201))
(define-constant ERR_INVALID_END_BLOCK (err u202))
(define-constant ERR_PROPOSAL_NOT_FOUND (err u203))
(define-constant ERR_ROUND_NOT_FOUND (err u204))
(define-constant ERR_CANNOT_VOTE_ON_PROPOSAL (err u205))
(define-constant ERR_INVALID_DONATION_TOKEN (err u206))
(define-constant ERR_PROPOSAL_NOT_IN_ROUND (err u207))
(define-constant ERR_ID_NOT_FOUND (err u208))
(define-constant ERR_ROUND_NOT_ACTIVE (err u209))
(define-constant ERR_INVALID_MATCH (err u210))
(define-constant ERR_ROUND_ENDED (err u211))
(define-constant ERR_TALLY_NOT_FOUND (err u212))
(define-constant ERR_PROPOSAL_DONATION_NOT_FOUND (err u213))
(define-constant ERR_INSUFFICIENT_MATCH (err u214))
(define-constant ERR_INVALID_MATCHING_TOKEN (err u215))
(define-constant ERR_CLAIM_ALREADY_MADE (err u216))
(define-constant ERR_ROUND_STILL_ACTIVE (err u217))
(define-constant ERR_UNAUTHORIZED (err u401))
(define-constant SCALE_FACTOR (pow u10 u8)) ;; 8 decimal places


(define-data-var total-rounds uint u0)
(define-data-var total-proposals uint u0)


;;;;;;;;;;;;;;;;;;;;
;; CONTRACT STATE ;;
;;;;;;;;;;;;;;;;;;;;

(define-map Rounds
    uint
    {
        round-admin: principal, 
        donation-token: principal,
        matching-token: principal,
        start-at: uint,
        end-at: uint,
        meta: (string-ascii 256),
        match: uint,
        proposals: (optional (list 200 uint))
    }
)

(define-map Proposals
    uint
    {
        owner: principal,
        meta: (string-ascii 256)
    }
)

(define-map Matches
    {round-id: uint, user: principal}
    uint
)

(define-map ProposalDonations
    {proposal-id: uint, round-id: uint}
    {acc: uint, sum-sqrt: uint, claimed: bool}
)

;;;;;;;;;;;;;;;;;;;;;;;
;; PRIVATE FUNCTIONS ;;
;;;;;;;;;;;;;;;;;;;;;;;

(define-private (filter-closure (id uint))
    (asserts! (is-ok (get-proposal id)) false)
)

(define-private (filter-ids (ids (optional (list 200 uint))))
    (match ids
        value (some (filter filter-closure value))
        none
    )
)

(define-private (scale-up (a uint))
  (* a SCALE_FACTOR)
)

(define-private (scale-down (a uint))
  (/ a SCALE_FACTOR)
)

(define-private (inner-sum (id uint) (val {acc: uint, round-id: uint}))
    (let (
        (acc (get acc val))
        (round-id (get round-id val))
        (tally (default-to {acc: u0, sum-sqrt: u0} (map-get? ProposalDonations {proposal-id: id, round-id: (get round-id val)})))
        (sum-sqrt (get sum-sqrt tally))
        (tally-sq (* sum-sqrt sum-sqrt))
    )
        {
            acc: (+ acc tally-sq),
            round-id: round-id
        }
    )
)

;;;;;;;;;;;;;;;;;;;;;;;
;; PUBLIC FUNCTIONS ;;
;;;;;;;;;;;;;;;;;;;;;;;

(define-public (create-round (round { 
        round-admin: principal, 
        donation-token: principal,
        matching-token: principal,
        start-at: uint,
        end-at: uint,
        meta: (string-ascii 256),
        proposals: (optional (list 200 uint))
    })
)
    (let (
        (start (get start-at round))
        (end (get end-at round))
        (round-id (var-get total-rounds))
        (proposal-ids (filter-ids (get proposals round)))
    )
        (asserts! (> start block-height) ERR_INVALID_START_BLOCK)
        (asserts! (> end start) ERR_INVALID_END_BLOCK)
        (map-set Rounds round-id (
            merge round {
                proposals: proposal-ids, 
                match: u0,
            })
        )
        (var-set total-rounds (+ u1 round-id))
        (ok (print {
            type: "create-round", 
            payload: { 
                round-id: round-id,
                start: start,
                end: end, 
                block-height: block-height 
            }
        }))
    )
)

(define-public (create-proposal (proposal {
        owner: principal,
        meta: (string-ascii 256)
    })
)
    (let (
        (proposal-id (var-get total-proposals))
    )
        (map-set Proposals proposal-id proposal)
        (var-set total-proposals (+ u1 proposal-id))
        (ok (print {
            type: "create-proposal", 
            payload: { 
                proposal-id: proposal-id,
                block-height: block-height 
            }
        }))
    )
)

(define-public (update-proposal 
    (proposal-id uint) 
    (proposal-updates {
        owner: (optional principal), 
        meta: (optional (string-ascii 256))
    })
)
    (let (
        (proposal (try! (get-proposal proposal-id)))
    )
        (asserts! (is-eq (get owner proposal) contract-caller) ERR_UNAUTHORIZED)
        (map-set Proposals proposal-id (merge proposal
            {
                owner: (default-to (get owner proposal) (get owner proposal-updates)), 
                meta: (default-to (get meta proposal) (get meta proposal-updates)), 
            }
        ))
        (ok (print {
            type: "update-proposal", 
            payload: { 
                proposal-id: proposal-id,
                block-height: block-height 
            }
        }))
    )
)


(define-public (add-match (round-id uint) (token <sip-010-token>) (amount uint))
    (let (
        (round (unwrap! (map-get? Rounds round-id) ERR_ROUND_NOT_FOUND))
        (prev-match (default-to u0 (map-get? Matches {round-id: round-id, user: contract-caller})))
    )
        (asserts! (is-eq (contract-of token) (get matching-token round)) ERR_INVALID_MATCH)
        (asserts! (> (get end-at round) block-height) ERR_ROUND_ENDED)
        (try! (contract-call? token transfer amount contract-caller CONTRACT_ADDRESS none))
        (map-set Rounds round-id (
            merge round {
                match: (+ (get match round) amount),
            })
        )
        (map-set Matches {round-id: round-id, user: contract-caller} (+ prev-match amount))
        (ok (print {
            type: "add-match", 
            payload: { 
                round-id: round-id,
                amount: amount,
                block-height: block-height
            }
        }))
    )
)

(define-public (donate 
    (proposal-id uint) 
    (token <sip-010-token>) 
    (amount uint) 
    (round-id uint)
)
    (let (
        (round (unwrap! (map-get? Rounds round-id) ERR_ROUND_NOT_FOUND))
        (proposal-ids (unwrap! (get proposals round) ERR_ID_NOT_FOUND))
        (proposal (unwrap! (map-get? Proposals proposal-id) ERR_PROPOSAL_NOT_FOUND))
        (decimals (try! (contract-call? token get-decimals)))
        (start (get start-at round))
        (end (get end-at round))
        (scaled (scale-up amount))
        (tally (default-to {acc: u0, sum-sqrt: u0} (map-get? ProposalDonations {proposal-id: proposal-id, round-id: round-id })))
        (sum-sqrt (+ (get sum-sqrt tally) (sqrti scaled)))
        (acc (+ (get acc tally) scaled))
    ) 
        (asserts! (is-some (index-of proposal-ids proposal-id)) ERR_PROPOSAL_NOT_IN_ROUND)
        (asserts! (and (> block-height start) (< block-height end)) ERR_ROUND_NOT_ACTIVE)
        (asserts! (is-eq (contract-of token) (get donation-token round)) ERR_INVALID_DONATION_TOKEN)
        (try! (contract-call? token transfer amount contract-caller (get owner proposal) none))
        (map-set ProposalDonations {proposal-id: proposal-id, round-id: round-id} {acc: acc, sum-sqrt: sum-sqrt, claimed: false})
        (ok (print {
            type: "donate", 
            payload: {
                proposal-id: proposal-id, 
                round-id: round-id,
                amount: amount,
                block-height: block-height
            }
        }))
    )
)


(define-public (update-round (round-id uint) (round-updates {
    round-admin: (optional principal), 
    donation-token: (optional principal),
    matching-token: (optional principal),
    start-at: (optional uint),
    end-at: (optional uint),
    meta: (optional (string-ascii 256)),
}))
    (let (
        (round (unwrap! (map-get? Rounds round-id) ERR_ROUND_NOT_FOUND))
        (start (get start-at round))
        (end (get end-at round))
    )
        (asserts! (is-eq (get round-admin round) contract-caller) ERR_UNAUTHORIZED)
        (asserts! (> start block-height) ERR_INVALID_START_BLOCK)
        (asserts! (> end start) ERR_INVALID_END_BLOCK)
        (map-set Rounds round-id (merge round
            {
                round-admin: (default-to (get round-admin round) (get round-admin round-updates)), 
                donation-token: (default-to (get donation-token round) (get donation-token round-updates)), 
                matching-token: (default-to (get matching-token round) (get matching-token round-updates)), 
                start-at: (default-to (get start-at round) (get start-at round-updates)), 
                end-at: (default-to (get end-at round) (get end-at round-updates)), 
                meta: (default-to (get meta round) (get meta round-updates)),
            }
        ))
        (ok (print {
            type: "update-round", 
            payload: {
                round-id: round-id,
                block-height: block-height
            }
        }))
    )
)

(define-public (replace-proposals (round-id uint) (proposals (list 200 uint)))
    (let (
        (round (unwrap! (map-get? Rounds round-id) ERR_ROUND_NOT_FOUND))
        (proposal-ids (filter-ids (some proposals)))
    ) 
        (asserts! (is-eq (get round-admin round) contract-caller) ERR_UNAUTHORIZED)
        (map-set Rounds round-id (merge round
            {
                proposals: proposal-ids
            }
        ))
        (ok (print {
            type: "replace-proposals", 
            payload: {
                round-id: round-id,
                block-height: block-height
            }
        }))
    )
)

(define-public (claim-single (round-id uint) (proposal-id uint) (token <sip-010-token>))
    (let (
        (proposal (try! (get-proposal proposal-id)))
        (round (try! (get-round round-id)))
        (matching (unwrap-panic (get-match round-id proposal-id)))
        (tally (try! (get-tally round-id proposal-id)))
        (matching-token (get matching-token round))
        (amount (get match matching))
    )
        (asserts! (> block-height (get end-at round)) ERR_ROUND_STILL_ACTIVE)
        (asserts! (not (get claimed matching)) ERR_CLAIM_ALREADY_MADE)
        (asserts! (is-eq (contract-of token) matching-token) ERR_INVALID_MATCHING_TOKEN)
        (asserts! (> amount u0) ERR_INSUFFICIENT_MATCH)
        (try! (as-contract (contract-call? token transfer amount CONTRACT_ADDRESS (get owner proposal) none)))
        (map-set ProposalDonations {proposal-id: proposal-id, round-id: round-id} (merge tally
            {
                claimed: true
            }
        ))
        (ok (print {
            type: "claim-single", 
            payload: {
                proposal-id: proposal-id, 
                round-id: round-id,
                amount: amount,
                block-height: block-height
            }
        }))
    )  
)

;;;;;;;;;;;;;;;;;;;;;;;;;
;; READ ONLY FUNCTIONS ;;
;;;;;;;;;;;;;;;;;;;;;;;;;


(define-read-only (get-match (round-id uint) (proposal-id uint))
    (let (
        (round (unwrap! (map-get? Rounds round-id) ERR_ROUND_NOT_FOUND))
        (tally (unwrap! (map-get? ProposalDonations {proposal-id: proposal-id, round-id: round-id }) ERR_PROPOSAL_DONATION_NOT_FOUND))
        (sum-sqrt (get sum-sqrt tally))
        (summed (fold inner-sum (unwrap-panic (get proposals round)) {acc: u0, round-id: round-id}))
        (acc (get acc summed))
        (total (scale-up (get match round)))
        (divisor (/ (* total SCALE_FACTOR) (get acc summed)))
    )
        (ok {
            claimed: (get claimed tally),
            funding-amount: (scale-down (get acc tally)),
            match: (scale-down (scale-down (* (* sum-sqrt sum-sqrt) divisor)))
        })
    )
)

(define-read-only (get-round (id uint))
    (ok (unwrap! (map-get? Rounds id) ERR_ROUND_NOT_FOUND))
)

(define-read-only (get-proposal (id uint))
    (ok (unwrap! (map-get? Proposals id) ERR_PROPOSAL_NOT_FOUND))
)

(define-read-only (get-tally (round-id uint) (proposal-id uint) )
    (ok (unwrap! (map-get? ProposalDonations {proposal-id: proposal-id, round-id: round-id} ) ERR_TALLY_NOT_FOUND))
)
