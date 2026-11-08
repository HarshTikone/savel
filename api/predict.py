"""Pure prediction math (PRD 'Math and status'). No I/O."""
import math

SETPOINT_F = 68.0
HEAT_RATE = 1.5  # per hour, furnace approach to setpoint


def hours_to(t_now, t_out, threshold, k):
    """Storm hours until a cooling home reaches threshold. None = never."""
    if t_now <= threshold:
        return 0.0
    if k is None or k <= 0 or threshold <= t_out:
        return None
    return math.log((t_now - t_out) / (threshold - t_out)) / k


def estimate(t_last, t_out, k, hours_silent):
    return t_out + (t_last - t_out) * math.exp(-k * hours_silent)


RECOVERED_F = 62.0


def status(temp_f, co_ppm, heating, h50, outcome, declining=True):
    """Thresholds use the measured temperature. A home is only warning/critical once it is
    unheated AND its temperature is confirmed falling (or already below 50F)."""
    if co_ppm >= 35:
        return "critical"
    if outcome == "leaving":
        return "leaving"
    if heating:
        return "recovering" if temp_f < RECOVERED_F else "heated"
    if temp_f < 50:
        return "critical"
    if temp_f < 60 and declining:
        return "warning"
    return "cooling"


def predict_curve(t_now, t_out, k, heating, hours=6, step_min=15):
    """[(minutes_ahead, temp)] from 0 to `hours`, every `step_min` minutes.
    Heated: approach 68°F at 1.5/h. Cooling: Newton with k. k None/<=0: flat."""
    out = []
    for m in range(0, hours * 60 + 1, step_min):
        h = m / 60
        if heating:
            temp = SETPOINT_F + (t_now - SETPOINT_F) * math.exp(-HEAT_RATE * h)
        elif k is None or k <= 0:
            temp = t_now
        else:
            temp = estimate(t_now, t_out, k, h)
        out.append((m, temp))
    return out


def median(values):
    vals = sorted(v for v in values if v is not None)
    if not vals:
        return None
    mid = len(vals) // 2
    return vals[mid] if len(vals) % 2 else (vals[mid - 1] + vals[mid]) / 2
