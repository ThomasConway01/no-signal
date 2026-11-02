/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * The scripted persona. It is the product when WebGPU or the model is missing,
 * and the understudy when the local model returns nothing.
 */

import type { Task } from './types';

/** Answer a task without leaving the device and without a model. */
export function scriptedRespond(task: Task, raw: string): string {
  const note = raw.replace(/\s+/g, ' ').trim();
  if (!note) {
    return 'There is nothing on the page. I will not invent an errand for you.';
  }
  if (task === 'summarise') return summarise(note);
  if (task === 'roast') return roast(note);
  return rewrite(note);
}

function summarise(note: string): string {
  const lower = note.toLowerCase();
  const lines: string[] = ['Field note, compressed.'];
  const tabs = note.match(/(\d+)\s+tabs?/i);
  const channels = ['slack', 'discord', 'email', 'group chat'].filter((name) => lower.includes(name));

  if (channels.length || tabs) {
    const door = channels.length
      ? `You are negotiating with ${humanList(channels)} before any work starts`
      : 'You are still in the hallway';
    const tabBit = tabs ? `, with ${tabs[1]} tabs already open` : '';
    lines.push(`${door}${tabBit}.`);
  }

  if (/\b(novel|essay|chapter|draft)\b/.test(lower)) {
    lines.push('The actual work is a piece of writing, currently losing to the scroll.');
  }
  if (lower.includes('tomorrow')) {
    lines.push('The quiet is scheduled for tomorrow, which is not a plan.');
  }

  // A note with none of the usual tells still gets its own bones back.
  if (lines.length === 1) {
    lines.push(firstSentence(note));
    lines.push(`${wordCount(note)} words. I kept the bones and dropped the fidgeting.`);
  }

  lines.push('', '— the bunker');
  return lines.join('\n');
}

function roast(note: string): string {
  const lower = note.toLowerCase();
  const hits: string[] = [];
  const tabs = note.match(/(\d+)\s+tabs?/i);
  if (tabs) hits.push(`${tabs[1]} tabs about how to focus. The tabs won.`);

  const shopping = note.match(/buy another [^?.!]{0,48}/i);
  if (shopping) {
    hits.push(`"${shopping[0].trim()}" — that is not a missing app. That is a door you keep opening.`);
  }

  const channels = ['slack', 'discord', 'email'].filter((name) => lower.includes(name));
  if (channels.length >= 2) {
    const listed = humanList(channels);
    hits.push(`${listed.charAt(0).toUpperCase()}${listed.slice(1)}. You listed the exits before the work.`);
  }

  if (lower.includes('tomorrow')) {
    hits.push('"I\'ll go offline tomorrow." Tomorrow is where this note goes to die.');
  }

  const bangs = (note.match(/!/g) ?? []).length;
  const justs = lower.match(/\bjust\b/g)?.length ?? 0;
  if (bangs >= 3 || justs > 0) {
    const bits: string[] = [];
    if (bangs >= 3) bits.push(`${bangs} exclamation marks`);
    if (justs > 0) bits.push(justs === 1 ? 'the word "just" once' : `the word "just" ${justs} times`);
    hits.push(`${humanList(bits)}. The kettle is on. The work is not.`);
  }

  if (lower.includes('scroll')) {
    hits.push('Research by scrolling is scrolling that brought a notebook.');
  }

  if (!hits.length) {
    if (wordCount(note) < 14) hits.push('Short enough to survive. I almost respect it.');
    else hits.push('A lot of weather, very little forecast.');
    const clip = note.slice(0, 90).trim();
    hits.push(`I quote you back to yourself: "${clip}"`);
  }

  hits.push('The bunker has heard worse. Not often.');
  return hits.join('\n\n');
}

function rewrite(note: string): string {
  const lower = note.toLowerCase();
  const lines: string[] = [];
  const tabs = note.match(/(\d+)\s+tabs?/i);
  const channels = ['slack', 'discord', 'email'].filter((name) => lower.includes(name));

  if (channels.length || /\bproductive\b/i.test(note)) lines.push('Today I will start the work.');
  if (channels.length) lines.push(`I will not open ${humanList(channels)} first.`);
  if (tabs) lines.push(`The ${tabs[1]} tabs can wait.`);

  const purchase = note.match(/buy another ([^?.!]+)/i);
  if (purchase) lines.push(`I will not buy another ${purchase[1].trim()}.`);
  if (lower.includes('group chat')) lines.push('I will leave the group chat where it is.');
  if (/\b(novel|essay|chapter|draft)\b/.test(lower)) {
    lines.push('I will do the writing instead of scrolling about it.');
  }
  if (lower.includes('tomorrow') && lower.includes('offline')) lines.push('I will go offline now.');
  else if (lower.includes('tomorrow')) lines.push('I will not move this to tomorrow.');

  // Notes that are already plain get a light clean and the bunker sign-off.
  if (!lines.length) lines.push(cleanupProse(note));

  lines.push('', '— rewritten in the quiet');
  return lines.join('\n');
}

function cleanupProse(note: string): string {
  let text = note.replace(/\s+/g, ' ').trim();
  text = text.replace(/!+/g, '.');
  text = text.replace(/\b(just|really|very|actually|maybe)\b/gi, '');
  text = text.replace(/\s{2,}/g, ' ').replace(/\s+([.?!])/g, '$1').trim();
  if (text && text[0] === text[0].toLowerCase()) text = text[0].toUpperCase() + text.slice(1);
  if (text && !/[.?!]$/.test(text)) text += '.';
  return text;
}

function firstSentence(note: string): string {
  const match = note.match(/^.*?[.!?](?=\s|$)/);
  return (match?.[0] ?? note).trim();
}

function wordCount(note: string): number {
  return note.split(/\s+/).filter(Boolean).length;
}

function humanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
