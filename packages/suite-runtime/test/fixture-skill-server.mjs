#!/usr/bin/env node
/**
 * A minimal server used only by skill-prompts.test.mjs: registers the
 * skills found in the directory given by FIXTURE_SKILLS_DIR against a stub
 * licence client whose answer is controlled by FIXTURE_ENTITLEMENT
 * ("paid" or "free"). Not shipped in any plugin.
 */
import { McpServer } from '../mcp-lite.js';
import { registerSkillPrompts } from '../skill-prompts.js';

const server = new McpServer({ name: 'skill-fixture', version: '0.0.0' });

const paid = process.env.FIXTURE_ENTITLEMENT === 'paid';
const client = {
  entitlement: async () => (paid
    ? { active: true, free: false, plan: 'pro', features: ['tools'] }
    : { active: true, free: true, plan: 'free', features: [], reason: 'missing_license' }),
};

registerSkillPrompts(server, client, { skillsDir: process.env.FIXTURE_SKILLS_DIR });

server.start();
