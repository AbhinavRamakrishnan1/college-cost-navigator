# Calculation boundary

This directory implements dependent-student Formula A SAI and Pell Scheduled Award
estimates. Independent-student formulas remain unsupported. Repayment lives in
`../repayment`; school-data comparisons live in `../scorecard`.

SAI arithmetic uses `decimal.js` and the frozen `docs/calculation-contract-v1.0.md`.
Unsupported or unavailable policy inputs fail closed. Public explanations and
primary-source references are available at `/methodology#sai` and `/methodology#pell`.
