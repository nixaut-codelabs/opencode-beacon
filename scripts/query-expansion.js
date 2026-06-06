#!/usr/bin/env node
import { expandQuery, expandQueryTurkish } from './lib/synonyms.js';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.error('Usage: query-expansion.js [--turkish] "<query>"');
  console.error('  --turkish    Enable Turkish language expansion');
  console.error('');
  console.error('Examples:');
  console.error('  node query-expansion.js "auth system"');
  console.error('  node query-expansion.js --turkish "giriş sistemi"');
  process.exit(args.length === 0 ? 1 : 0);
}

const useTurkish = args.includes('--turkish');
const queryParts = args.filter(a => a !== '--turkish');
const query = queryParts.join(' ');

const expanded = useTurkish ? expandQueryTurkish(query) : expandQuery(query);

console.log(JSON.stringify(expanded, null, 2));
