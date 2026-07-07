require("dotenv").config();
const mongoose = require("mongoose");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const tz = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(tz);

const TZ = "America/Santiago";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const date = "2026-06-24";
  const origin = "Santiago";
  const destination = "Talca";

  const start = dayjs.tz(date, TZ).startOf("day").toDate();
  const end = dayjs.tz(date, TZ).endOf("day").toDate();

  console.log("Query parameters:");
  console.log("- Date:", date);
  console.log("- Start Date (UTC):", start.toISOString());
  console.log("- End Date (UTC):", end.toISOString());
  console.log("- Origin:", origin);
  console.log("- Destination:", destination);

  const Service = require("../models/Service");
  const City = require("../models/City");
  const BusLayout = require("../models/BusLayout");
  const RouteMaster = require("../models/RouteMaster");

  const servicesRaw = await Service.find({
    date: { $gte: start, $lte: end },
    departures: {
      $all: [
        { $elemMatch: { stop: origin } },
        { $elemMatch: { stop: destination } }
      ]
    }
  });

  console.log("Found Raw Services count:", servicesRaw.length);
  if (servicesRaw.length > 0) {
    servicesRaw.forEach(s => {
      console.log(`Service ID: ${s._id}, Date: ${s.date.toISOString()}`);
      console.log("Departures:");
      s.departures.forEach(d => console.log(`  - Stop: ${d.stop}, Order: ${d.order}`));
    });

    const servicesFiltered = servicesRaw.filter(service => {
      const depOrigin = service.departures.find(d => d.stop === origin);
      const depDest = service.departures.find(d => d.stop === destination);
      console.log("Origin Order:", depOrigin ? depOrigin.order : 'not found');
      console.log("Destination Order:", depDest ? depDest.order : 'not found');
      return depOrigin && depDest && depOrigin.order < depDest.order;
    });

    console.log("Filtered Services count:", servicesFiltered.length);
  }

  process.exit(0);
}

run().catch(console.error);
