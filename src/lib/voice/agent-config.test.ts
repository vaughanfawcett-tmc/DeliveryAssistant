import { describe, it, expect } from 'vitest';
import { agentConfig, TOOL_PATHS } from './agent-config';
import { DISCLOSURE } from './compliance';

describe('agentConfig', () => {
  describe('first_message', () => {
    it('equals DISCLOSURE exactly (VOICE-01 / T-04-27)', () => {
      expect(agentConfig.first_message).toBe(DISCLOSURE);
    });

    it('is a non-empty string', () => {
      expect(typeof agentConfig.first_message).toBe('string');
      expect(agentConfig.first_message.length).toBeGreaterThan(0);
    });
  });

  describe('tools', () => {
    it('has exactly 5 tools', () => {
      expect(agentConfig.tools).toHaveLength(5);
    });

    it('contains all five expected url_paths', () => {
      const paths = agentConfig.tools.map((t) => t.url_path);
      expect(paths).toContain('/api/voice/lookup_consignment');
      expect(paths).toContain('/api/voice/request_human');
      expect(paths).toContain('/api/voice/contact_driver');
      expect(paths).toContain('/api/voice/call_started');
      expect(paths).toContain('/api/voice/call_ended');
    });

    it('each tool has a name, url_path, and description', () => {
      for (const tool of agentConfig.tools) {
        expect(typeof tool.name).toBe('string');
        expect(tool.name.length).toBeGreaterThan(0);
        expect(typeof tool.url_path).toBe('string');
        expect(tool.url_path).toMatch(/^\/api\/voice\//);
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('TOOL_PATHS', () => {
    it('has exactly 5 entries', () => {
      expect(TOOL_PATHS).toHaveLength(5);
    });

    it('matches the url_paths on agentConfig.tools', () => {
      const configPaths = agentConfig.tools.map((t) => t.url_path);
      for (const path of TOOL_PATHS) {
        expect(configPaths).toContain(path);
      }
    });
  });

  describe('system_prompt', () => {
    it('mentions NATO phonetic read-back', () => {
      expect(agentConfig.system_prompt).toMatch(/NATO/i);
    });

    it('encodes the never-invent-data rule (VOICE-08)', () => {
      // At least one of these phrases must appear in the prompt
      const neverInventPhrases = [
        'never invent',
        'only state information returned',
        'do not fabricate',
        'Never invent',
        'Only state information returned',
      ];
      const found = neverInventPhrases.some((phrase) =>
        agentConfig.system_prompt.includes(phrase)
      );
      expect(found).toBe(true);
    });

    it('is a non-empty string', () => {
      expect(typeof agentConfig.system_prompt).toBe('string');
      expect(agentConfig.system_prompt.length).toBeGreaterThan(100);
    });
  });

  describe('dtmf', () => {
    it('sets terminator to "#" (VOICE-03)', () => {
      expect(agentConfig.dtmf.terminator).toBe('#');
    });
  });
});
