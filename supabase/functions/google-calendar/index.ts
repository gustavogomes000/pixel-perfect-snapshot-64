const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CALENDAR_ICAL_URL = 'https://calendar.google.com/calendar/ical/1d0115116c881751957170d2e0a224901814fa8de5e1e53be0d0f14066da18ac%40group.calendar.google.com/public/basic.ics';
const CALENDAR_TIME_ZONE = 'America/Sao_Paulo';

const MESES: Record<number, string> = {
  0: 'JAN', 1: 'FEV', 2: 'MAR', 3: 'ABR', 4: 'MAI', 5: 'JUN',
  6: 'JUL', 7: 'AGO', 8: 'SET', 9: 'OUT', 10: 'NOV', 11: 'DEZ',
};

const DAY_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: CALENDAR_TIME_ZONE,
  day: '2-digit',
});

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: CALENDAR_TIME_ZONE,
  month: 'numeric',
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: CALENDAR_TIME_ZONE,
  weekday: 'long',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: CALENDAR_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

interface CalendarEvent {
  id: string;
  titulo: string;
  desc: string;
  local: string;
  dia: string;
  mes: string;
  diaSemana: string;
  hora: string;
  horaFim: string;
  dataISO: string;
  dataFimISO: string;
  passado: boolean;
  gcal: string;
  mapsUrl: string;
}

function parseICalDate(val: string): Date {
  const year = parseInt(val.slice(0, 4));
  const month = parseInt(val.slice(4, 6)) - 1;
  const day = parseInt(val.slice(6, 8));

  if (val.length === 8) {
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }

  const hour = parseInt(val.slice(9, 11));
  const minute = parseInt(val.slice(11, 13));
  const second = parseInt(val.slice(13, 15));

  if (val.endsWith('Z')) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  // Google iCal feed usually returns floating times in the calendar local timezone.
  // We convert them to UTC while preserving São Paulo wall-clock time for display.
  return new Date(Date.UTC(year, month, day, hour + 3, minute, second));
}

function buildGCalLink(event: { titulo: string; desc: string; local: string; start: string; end: string }): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.titulo,
    dates: `${event.start}/${event.end}`,
    details: event.desc,
    location: event.local,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildMapsUrl(location: string): string {
  if (!location) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function getCalendarNow(): Date {
  const now = new Date();
  const localNow = new Intl.DateTimeFormat('sv-SE', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  return new Date(localNow.replace(' ', 'T') + 'Z');
}

function getEventDateParts(date: Date) {
  const monthIndex = Number(MONTH_FORMATTER.format(date)) - 1;

  return {
    dia: DAY_FORMATTER.format(date),
    mes: MESES[monthIndex],
    diaSemana: WEEKDAY_FORMATTER.format(date),
    hora: TIME_FORMATTER.format(date),
  };
}

function parseICalFeed(icsText: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const vevents = icsText.split('BEGIN:VEVENT');
  const calendarNow = getCalendarNow();

  for (let i = 1; i < vevents.length; i++) {
    const block = vevents[i].split('END:VEVENT')[0];
    const lines = block.split(/\r?\n/);

    const props: Record<string, string> = {};
    let currentKey = '';

    for (const line of lines) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        if (currentKey) {
          props[currentKey] += line.slice(1);
        }
        continue;
      }
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      let key = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1);
      const semiIdx = key.indexOf(';');
      if (semiIdx !== -1) key = key.slice(0, semiIdx);
      key = key.trim().toUpperCase();
      props[key] = value.trim();
      currentKey = key;
    }

    const dtstart = props['DTSTART'] || '';
    const dtend = props['DTEND'] || dtstart;
    const summary = (props['SUMMARY'] || 'Sem título').replace(/\\,/g, ',').replace(/\\n/g, '\n');
    const description = (props['DESCRIPTION'] || '').replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\;/g, ';');
    const location = (props['LOCATION'] || '').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const uid = props['UID'] || `event-${i}`;

    const normalizedSummary = summary.toLowerCase().trim();
    const isBusyBlock =
      normalizedSummary === 'busy' ||
      normalizedSummary === 'ocupado' ||
      normalizedSummary === 'free' ||
      normalizedSummary === 'livre' ||
      normalizedSummary === 'sem título' ||
      normalizedSummary.startsWith('busy ') ||
      normalizedSummary.includes('out of office') ||
      normalizedSummary.includes('working location');

    if (!dtstart || isBusyBlock) continue;

    const startDate = parseICalDate(dtstart);
    const endDate = parseICalDate(dtend);
    const startParts = getEventDateParts(startDate);
    const endParts = getEventDateParts(endDate);

    events.push({
      id: uid,
      titulo: summary,
      desc: description,
      local: location,
      dia: startParts.dia,
      mes: startParts.mes,
      diaSemana: startParts.diaSemana,
      hora: startParts.hora,
      horaFim: endParts.hora,
      dataISO: startDate.toISOString(),
      dataFimISO: endDate.toISOString(),
      passado: endDate < calendarNow,
      gcal: buildGCalLink({
        titulo: summary,
        desc: description,
        local: location,
        start: dtstart.replace(/[-:]/g, ''),
        end: dtend.replace(/[-:]/g, ''),
      }),
      mapsUrl: buildMapsUrl(location),
    });
  }

  events.sort((a, b) => new Date(a.dataISO).getTime() - new Date(b.dataISO).getTime());
  return events;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const filterParam = url.searchParams.get('filter');

    console.log('[google-calendar] Fetching iCal feed...');
    const response = await fetch(CALENDAR_ICAL_URL, {
      headers: { 'Accept': 'text/calendar' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status}`);
    }

    const icsText = await response.text();
    console.log('[google-calendar] iCal text length:', icsText.length);
    let events = parseICalFeed(icsText);

    const filter = filterParam || 'all';
    if (filter === 'proximos') {
      events = events.filter(e => !e.passado);
    } else if (filter === 'passados') {
      events = events.filter(e => e.passado);
    }

    if (limitParam) {
      const limit = parseInt(limitParam);
      if (!isNaN(limit) && limit > 0) {
        if (filter === 'passados') {
          events = events.slice(-limit);
        } else {
          events = events.slice(0, limit);
        }
      }
    }

    console.log(`[google-calendar] Returning ${events.length} events (filter: ${filter})`);

    return new Response(
      JSON.stringify({ success: true, events, generatedAt: Date.now() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[google-calendar] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, events: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
