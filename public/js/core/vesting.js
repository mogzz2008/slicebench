/** Standard startup vesting: monthly over `vestMonths`, with a `cliffMonths` cliff. */

export function vestedFraction(leaveMonth, vestMonths = 48, cliffMonths = 12) {
  const leave = Number(leaveMonth);
  const vest = Number(vestMonths);
  const cliff = Number(cliffMonths);
  if (!Number.isFinite(leave) || leave < 0) return 0;
  if (!Number.isFinite(vest) || vest <= 0) return 0;
  if (leave < cliff) return 0;
  return Math.min(1, leave / vest);
}

export function vestedShares(grantShares, leaveMonth, vestMonths = 48, cliffMonths = 12) {
  return grantShares * vestedFraction(leaveMonth, vestMonths, cliffMonths);
}

export function forfeitShares(grantShares, leaveMonth, vestMonths = 48, cliffMonths = 12) {
  return Math.max(0, grantShares - vestedShares(grantShares, leaveMonth, vestMonths, cliffMonths));
}
