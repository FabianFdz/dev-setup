'use strict';
/**
 * Source of truth for the handoff protocol's agent graph.
 * Keep in sync with ../../schemas/handoff.schema.json's agent enum.
 */

const AGENT_NAMES = ['planner', 'architect', 'coder', 'reviewer', 'documenter', 'human'];

const HANDOFF_STATUSES = ['pending', 'in_progress', 'approved', 'rejected'];

/**
 * Forward transitions. Reviewer approval goes to "human" (the coordinator),
 * which — once every ticket is done and merged — writes human-to-documenter.json.
 */
const FORWARD_TRANSITIONS = [
  ['planner', 'architect'],
  ['architect', 'coder'],
  ['coder', 'reviewer'],
  ['reviewer', 'human'],
  ['human', 'documenter'],
  ['documenter', 'human'],
];

/** Rejection back-edges — direct, no fan-in. */
const REJECTION_TRANSITIONS = [
  ['reviewer', 'coder'],
];

const VALID_TRANSITIONS = [...FORWARD_TRANSITIONS, ...REJECTION_TRANSITIONS];

function isValidTransition(from, to) {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

module.exports = {
  AGENT_NAMES,
  HANDOFF_STATUSES,
  FORWARD_TRANSITIONS,
  REJECTION_TRANSITIONS,
  VALID_TRANSITIONS,
  isValidTransition,
};
