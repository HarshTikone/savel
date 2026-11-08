# SAVEL: Devpost draft

**Tagline:** When the power goes out in winter, SAVEL tells responders which homes will get dangerously cold, calls the residents to find out who needs help, and ranks who to reach first.

## Inspiration
Winter outages kill people quietly. A house loses heat, an older resident with oxygen or mobility needs does not call anyone, and responders do not know where to go first. Cold-weather outages and carbon monoxide from blocked vents or improvised heat are the two ways it goes wrong. Responders have maps of outages, but not of which homes are actually getting cold.

## What it does
- **Per-home countdown.** Indoor temperature and CO sensors stream readings. For every home, SAVEL fits that house's own cooling rate (Newton's law of cooling) and predicts the time until it reaches 60 F and 50 F.
- **Trend check.** For every home in a block that lost power, SAVEL fits a robust line through the last 15 readings and labels the trend (steady decline, slowing, flat, rising, noisy). The block summary reads "9 of 10 homes declining", so a warning is confirmed by the data and not by one noisy sensor.
- **Automated check-in calls.** An ElevenLabs voice agent calls at-risk residents, asks four short questions (is it getting cold, do you need help, any medical issue, can you leave) and ends the call itself. It keeps to the cold house and getting help.
- **Structured results.** Gemini turns the transcript into fields (has heat, needs help, medical issue, can leave) with a keyword fallback if the model is unavailable.
- **Ranked responder view.** A deterministic risk score (0-100) combines time to threshold, temperature, age, medical needs, CO, call outcome and whether the sensor went offline. The map and priority queue show who to reach first. Briefings and an incident summary are generated for responders.
- **CO safety.** A blocked vent with a running furnace raises CO; the system flags it and raises the home's priority.
- **Works with no connection.** Estimation runs from the readings the backend already holds; a sensor that goes quiet is itself a risk signal.

## How we built it
TimescaleDB for readings, a FastAPI backend with one loop that recomputes every home every 2 seconds, a React and Leaflet dashboard, a storm simulator with 40 synthetic homes (per-home cooling rates, staggered power loss, wind gusts, sensor noise, spikes and dropouts, seeded so a run is repeatable), the ElevenLabs Agents platform with a signed post-call webhook, and Gemini for extraction and briefings. The risk score and the trend check are plain deterministic code, so every ranking can be explained. The dashboard connects the voice agent automatically when a home's live call rings.

## Challenges
Browser audio rules (a person has to click once before audio plays), keeping a live demo call from stalling the simulation, making the agent short and direct, and making a simulation feel real instead of scripted.

## Accomplishments
A full loop that works end to end: power cut, warning in about 35 seconds, automatic calls, a real spoken conversation, extracted fields, and the home moving up the ranking.

## Honest limits
This is a simulation with synthetic residents and homes. SAVEL is decision support for responders, not a dispatch system and not a replacement for 911. The cooling model and the simulator share the same physics, so the accuracy panel flatters the model; real homes need real sensor data to validate it.

## What's next
Real sensor pilot with a utility or community group, real phone calls (Twilio), more languages, and validation of the model against measured outage data.

## Built with
Python, FastAPI, TimescaleDB, React, Leaflet, ElevenLabs Agents, Google Gemini, Docker.

---

# 4-minute pitch script

**0:00-0:30 Problem.** "When the power goes out in a Buffalo winter, a house loses about five degrees an hour. Responders can see which blocks lost power. They cannot see which homes are getting dangerous, or which resident will never call for help. SAVEL answers that."

**0:30-1:15 Cut the power (live).** Reset, cut Block B. "Each dot is a home with a temperature sensor. Watch the countdown." About 35 seconds later: "Warnings. Each home has its own predicted time to 60 and 50 F, from its own cooling rate. The trend check confirms it: nine of ten homes in the block are declining, so this is not one bad sensor."

**1:15-2:30 The call.** "SAVEL now calls the residents. Most are automated scripted check-ins for the demo. This one is live." The agent connects by itself. Speak as the resident: "Yes, it's freezing. I have oxygen and I can't leave." "It asks four questions and hangs up. Gemini turns the conversation into structured fields."

**2:30-3:15 Ranking.** "The home jumps to the top: risk 100, because of cold, oxygen, and a call that said they need help. The score is plain arithmetic, so a responder can see why. Residents who do not answer rise too, because silence is a signal."

**3:15-3:40 CO.** Block a vent: "A blocked vent with a running furnace raises carbon monoxide. Same dashboard, same ranking."

**3:40-4:00 Honest close.** "This is a simulation with synthetic residents. It is decision support for responders, not dispatch. What it shows is the loop: predict, call, understand, rank. Thank you."

## With vs without SAVEL (for Q&A)
Without: responders know a block has no power and start with the loudest calls. With: every home has a countdown, the quiet at-risk residents are called automatically within seconds of the warning, and the first list a responder opens is already ranked with the reason. Measure to report from the demo: seconds from power cut to first warning (about 35) and seconds from warning to a structured, ranked result for a live call (about 1 to 2 minutes, mostly the conversation).

## Likely questions
- *Is this real data?* No: simulated sensors and synthetic residents; the model and score are real code.
- *Why not an LLM for risk?* So the ranking is explainable and repeatable; the LLM only extracts fields and writes briefings.
- *Privacy?* Synthetic data only; a real deployment needs consent from residents and sensor opt-in.
