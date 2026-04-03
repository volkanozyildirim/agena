import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

const FILE = join(process.cwd(), 'contact-messages.json');

interface Message {
  name: string;
  email: string;
  message: string;
  newsletter: boolean;
  date: string;
}

async function getMessages(): Promise<Message[]> {
  try {
    const data = await readFile(FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, message, newsletter } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const messages = await getMessages();
    messages.push({
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 200),
      message: String(message).slice(0, 2000),
      newsletter: !!newsletter,
      date: new Date().toISOString(),
    });
    await writeFile(FILE, JSON.stringify(messages, null, 2));

    // Also add to newsletter if opted in
    if (newsletter) {
      const nlFile = join(process.cwd(), 'newsletter-subscribers.json');
      let subs: string[] = [];
      try {
        subs = JSON.parse(await readFile(nlFile, 'utf-8'));
      } catch { /* empty */ }
      const normalized = String(email).trim().toLowerCase();
      if (!subs.includes(normalized)) {
        subs.push(normalized);
        await writeFile(nlFile, JSON.stringify(subs, null, 2));
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
