(define-constant CONTRACT_OWNER tx-sender)

;; ERROR CODES

(define-constant ERR_UNAUTHORIZED u2000)
(define-constant ERR_TOKEN_NOT_ACTIVATED u2001)
(define-constant ERR_TOKEN_ALREADY_ACTIVATED u2002)

;; SIP-010 DEFINITION

(impl-trait .sip-010-trait-ft-standard.sip-010-trait)

(define-fungible-token miamicoin)

;; SIP-010 FUNCTIONS

(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq from tx-sender) (err ERR_UNAUTHORIZED))
    (if (is-some memo)
      (print memo)
      none
    )
    (ft-transfer? miamicoin amount from to)
  )
)

(define-read-only (get-name)
  (ok "miamicoin")
)

(define-read-only (get-symbol)
  (ok "MIA")
)

(define-read-only (get-decimals)
  (ok u0)
)

(define-read-only (get-balance (user principal))
  (ok (ft-get-balance miamicoin user))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply miamicoin))
)

(define-read-only (get-token-uri)
  (ok (var-get tokenUri))
)

;; TOKEN CONFIGURATION
;; UTILITIES

(define-data-var tokenUri (optional (string-utf8 256)) (some u"https://cdn.citycoins.co/metadata/miamicoin.json"))

;; mint new tokens, only accessible by a Core contract
(define-public (mint (amount uint) (recipient principal))
  (ft-mint? miamicoin amount recipient)
)

;; SEND-MANY

(define-public (send-many (recipients (list 200 { to: principal, amount: uint, memo: (optional (buff 34)) })))
  (fold check-err
    (map send-token recipients)
    (ok true)
  )
)

(define-private (check-err (result (response bool uint)) (prior (response bool uint)))
  (match prior ok-value result
               err-value (err err-value)
  )
)

(define-private (send-token (recipient { to: principal, amount: uint, memo: (optional (buff 34)) }))
  (send-token-with-memo (get amount recipient) (get to recipient) (get memo recipient))
)

(define-private (send-token-with-memo (amount uint) (to principal) (memo (optional (buff 34))))
  (let
    (
      (transferOk (try! (transfer amount tx-sender to memo)))
    )
    (ok transferOk)
  )
)

(ft-mint? miamicoin u100000000000000 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)
(ft-mint? miamicoin u100000000000000 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
(ft-mint? miamicoin u100000000000000 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)
(ft-mint? miamicoin u100000000000000 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC)
(ft-mint? miamicoin u100000000000000 'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND)
(ft-mint? miamicoin u100000000000000 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB)
(ft-mint? miamicoin u100000000000000 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0)
(ft-mint? miamicoin u100000000000000 'ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ)
(ft-mint? miamicoin u100000000000000 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP)
