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

**0:30-1:00 Setup.** Two windows: the Responder page on the projector, the Simulation page on your laptop. "Forty homes, all warm. Each has a temperature sensor."

**1:00-1:40 Cut one house (live).** On the Simulation page pick H-13 and press "Cut power to H-13". "No power at H-13. It's cooling. SAVEL is learning how fast this particular house loses heat." The story bar walks the steps: Power cut, then Cooling detected, then Threshold crossed. "After about ten readings it knows: this house hits 50 degrees in about two hours. That is the warning, before anyone is cold."

**1:40-2:40 The call.** "SAVEL calls the resident by itself." The voice agent connects automatically. Speak as the resident: "It's freezing, no heat. I'm on oxygen and I can't drive." The transcript fills in live, then Gemini turns it into fields: no heat, needs help, medical, can't leave.

**2:40-3:15 Ranked first, help delivered.** "H-13 jumps to number one in the priority list. The score is plain arithmetic, so a responder can see why." Press the green check, "Mark help delivered". "The responder is on site, the circuit is closed, power is back." The house turns from orange back to green as it warms up, and the story ends at Back to normal.

**3:15-3:40 Scale.** "The same loop runs for a whole block": reset with the Block B outage to show ten homes ranked at once, or block a furnace vent to show carbon monoxide.

**3:40-4:00 Honest close.** "This is a simulation with synthetic residents. It is decision support for responders, not dispatch. What it shows is the loop: predict, call, understand, rank. Thank you."

## With vs without SAVEL (for Q&A)
Without: responders know a block has no power and start with the loudest calls. With: every home has a countdown, the quiet at-risk residents are called automatically within seconds of the warning, and the first list a responder opens is already ranked with the reason. Measure to report from the demo: seconds from power cut to first warning (about 10 to 20 for one house) and seconds from warning to a structured, ranked result for a live call (about 1 to 2 minutes, mostly the conversation).

## Likely questions
- *Is this real data?* No: simulated sensors and synthetic residents; the model and score are real code.
- *Why not an LLM for risk?* So the ranking is explainable and repeatable; the LLM only extracts fields and writes briefings.
- *Privacy?* Synthetic data only; a real deployment needs consent from residents and sensor opt-in.
