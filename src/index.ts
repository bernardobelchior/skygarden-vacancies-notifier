import axios from 'axios';
import * as Table from 'cli-table';
import * as notifier from 'node-notifier';

interface TicketSpace {
    name: string;
    left: number;
}

interface Event {
    datetime: Date,
    ticketsLeft: number,
    updated: Date,
}

function convertDate(date: Date): string {
    return date.toLocaleDateString('pt-PT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

async function get(startDate: Date, endDate: Date): Promise<Event[]> {
    const {data} = await axios.get('https://skygarden.bookingbug.com/api/v1/37002/events', {
        params: {
            start_date: convertDate(startDate),
            end_date: convertDate(endDate)
        },
        headers: {
            'App-Id': 'f6b16c23',
            'App-Key': 'f0bc4f65f4fbfe7b4b3b7264b655f5eb',
        },
    });

    if (data.total_entries === 0) {
        return [];
    }

    return data._embedded.events.map(event => ({
        datetime: new Date(event.datetime),
        ticketsLeft: Object.values(event.ticket_spaces).reduce((sum: number, ticketSpace: TicketSpace) => ticketSpace.name !== 'Walk In' ? sum + ticketSpace.left : sum, 0),
        updated: new Date(),
    }));
}

function getEventsWithTicketsLeft(entries: Event[]): Event[] {
    return entries.filter(r => r.ticketsLeft > 0)
}

function createTableFromEntries(entries: Event[]): Table {
    const table = new Table({
        head: ['Date', 'Time', 'Tickets Left', 'Updated At']
    });

    const ticketsLeft = getEventsWithTicketsLeft(entries).map(r =>
        [r.datetime.toLocaleDateString(), r.datetime.toLocaleTimeString(), r.ticketsLeft, r.updated.toLocaleTimeString()]
    );

    Array.prototype.push.apply(table, ticketsLeft);

    return table;
}

function notifyIfTicketsLeft(entries: Event[]) {
    const eventsWithTicketsLeft = getEventsWithTicketsLeft(entries);

    if (eventsWithTicketsLeft.length > 0) {
        notifier.notify({
            title: 'Sky Garden: Tickets Available!',
            message: 'There are tickets available for Sky Garden, check your terminal.',
        });
    }
}

async function getAll() {
    let entries = [];
    const startDate = new Date();
    let lastDate = new Date();
    let twoDaysFromLastDate = new Date();
    twoDaysFromLastDate.setDate(lastDate.getDate() + 2);

    let newEntries = [];

    console.clear();

    do {
        console.log(`Requesting dates: ${lastDate.toLocaleDateString()} - ${twoDaysFromLastDate.toLocaleDateString()}...`);
        newEntries = await get(lastDate, twoDaysFromLastDate);
        entries.push(...newEntries);
        lastDate.setDate(lastDate.getDate() + 2);
        twoDaysFromLastDate.setDate(lastDate.getDate() + 2);

        const table = createTableFromEntries(entries);
        notifyIfTicketsLeft(newEntries);

        console.clear();
        console.log(`From ${startDate.toLocaleDateString()} to ${twoDaysFromLastDate.toLocaleDateString()}\n`);
        console.log(table.toString());
        console.log('Book here: https://skygarden.london/booking');
    } while (newEntries.length > 0);

    return entries;
}

setInterval(() => getAll(), 3 * 60 * 1000);

getAll();
