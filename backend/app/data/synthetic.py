"""Deterministic simulated OSINT dataset (docs/05_DATA_PIPELINE.md).

One generator feeds both the in-memory development store and the Neo4j seed
script, so memory mode and Aura always contain the same investigation.

Everything here is fictional: places (Port Avalon, Northgate), organisations
(Meridian Bank, Solvix) and accounts are invented. Addresses use the RFC 5737
documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24).

IDs use their own namespace (``usr_``, ``pst_``, ``tag_``, ``net_``) so seeding never collides
with legacy seed data (``u_001``, ``p_001``, ``h_001``, ``ip_101`` …) already in a database.

The dataset contains:
* 200 accounts across X, Telegram and Facebook (160 organic, 40 campaign).
* 2,000 posts over the last 30 days.
* Six coordinated campaigns: accounts on shared infrastructure posting near-identical
  text with a shared hashtag inside a tight burst, amplified by retweets.
* A few benign shared-IP groups (campus / office NAT) so the analyst — and the AI —
  must distinguish coordination from coincidence.
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

SEED = 554
TOTAL_USERS = 200
TOTAL_POSTS = 2000
WINDOW_DAYS = 30
PLATFORMS = ("X", "Telegram", "Facebook")


@dataclass(frozen=True)
class Campaign:
    key: str
    hashtag: str
    platform: str
    size: int
    hours_ago: float
    burst_minutes: int
    ip_address: str
    geo_region: str
    network_type: str
    templates: tuple[str, ...]
    secondary_tag: str


CAMPAIGNS: tuple[Campaign, ...] = (
    Campaign(
        "water", "#AvalonWaterAlert", "X", 8, 2.5, 34, "192.0.2.100", "UNKNOWN-PROXY", "datacenter",
        (
            "BREAKING: officials are hiding contamination in the Avalon reservoir. Boil your water and share before this is deleted!",
            "BREAKING: officials hiding contamination in Avalon reservoir!! Boil your water and SHARE before it gets deleted",
            "They are hiding the Avalon reservoir contamination. Boil all water. Share before this is deleted!",
        ),
        "#PortAvalon",
    ),
    Campaign(
        "grid", "#GridBlackoutTruth", "Telegram", 7, 27, 41, "203.0.113.200", "EU-WEST-VPN", "vpn",
        (
            "The Northgate 'maintenance' blackout was planned. Stock up on fuel now, they will not warn you twice.",
            "Northgate blackout was PLANNED. Stock up on fuel now — they won't warn you twice.",
            "Planned blackout in Northgate, not maintenance. Get fuel today, there will be no second warning.",
        ),
        "#Northgate",
    ),
    Campaign(
        "cure", "#SolvixCure", "Facebook", 7, 74, 52, "198.51.100.250", "APAC-HOSTING", "datacenter",
        (
            "Doctors don't want you to know: Solvix herbal tea reversed my diabetes in 9 days. Link in bio before it's banned.",
            "Doctors won't tell you this — Solvix tea reversed my diabetes in 9 days!! Get it before they ban it",
            "Solvix tea reversed diabetes in just 9 days. Doctors are hiding it. Order before it's banned.",
        ),
        "#HealthFreedom",
    ),
    Campaign(
        "bank", "#MeridianBankRun", "X", 6, 122, 28, "192.0.2.180", "US-EAST-PROXY", "datacenter",
        (
            "Insider: Meridian Bank freezes withdrawals on Monday. Pull your savings TODAY.",
            "Meridian Bank insider says withdrawals frozen Monday. Withdraw your savings today!",
            "Heard from an insider: Meridian Bank is freezing withdrawals Monday. Get your money out now.",
        ),
        "#Finance",
    ),
    Campaign(
        "strike", "#TransitStrikeLeak", "Telegram", 6, 215, 63, "203.0.113.210", "EU-CENTRAL-VPN", "vpn",
        (
            "Leaked memo shows Avalon transit workers were paid by outside groups to strike. Read it before it disappears.",
            "LEAKED memo: transit strikers in Avalon were PAID by outside groups. Read before it disappears",
            "Avalon transit strike was paid for by outside groups — leaked memo proves it. Read it before it's gone.",
        ),
        "#TransitStrike",
    ),
    Campaign(
        "airdrop", "#AvaCoinAirdrop", "X", 6, 30, 19, "198.51.100.240", "UNKNOWN-PROXY", "datacenter",
        (
            "Official AvaCoin airdrop is LIVE. Connect your wallet in the next hour to claim 500 AVA.",
            "AvaCoin airdrop live now! Connect wallet within the hour and claim your 500 AVA.",
            "Claim 500 AVA — the official AvaCoin airdrop closes in one hour. Connect your wallet now.",
        ),
        "#Crypto",
    ),
)

ORGANIC_TAGS = (
    "#PortAvalon", "#Northgate", "#LocalNews", "#FactCheck", "#OpenSourceIntel",
    "#StormWatch", "#TransitStrike", "#HarborFestival", "#EnergyPrices", "#CivicMonitor",
    "#HealthFreedom", "#Finance", "#Crypto", "#CityCouncil",
)

ORGANIC_TEMPLATES = (
    ("Council meeting tonight on {issue}. Anyone planning to attend?", 0.05),
    ("Good thread comparing three sources on the {issue} story. Worth reading before sharing.", 0.08),
    ("Photos from the {event} this morning, crowds are bigger than last year.", 0.04),
    ("Can anyone verify this claim about {issue}? I can't find a primary source.", 0.22),
    ("Reverse image search shows this {issue} photo is from 2019, not this week.", 0.18),
    ("Local reporters say the {issue} situation is stable for now. Will update.", 0.10),
    ("Seeing a lot of identical posts about {issue} today. Feels coordinated?", 0.35),
    ("Official statement on {issue} is out. Link in the replies.", 0.07),
    ("Not sure what to believe about {issue} anymore, so many conflicting posts.", 0.28),
    ("Traffic is backed up near the harbour because of the {event}.", 0.03),
    ("Translated excerpt about {issue} is spreading without its original context.", 0.40),
    ("Heard a rumour about {issue} at work. Probably nothing, but keeping an eye on it.", 0.30),
    ("Our team fact-checked the viral {issue} claim: misleading, details in thread.", 0.15),
    ("Prices at the pump went up again this week. {issue} is all anyone talks about.", 0.12),
    ("Archived the original {issue} post in case it gets edited.", 0.20),
    ("Storm warning for Northgate tonight. Secure loose items, stay safe.", 0.06),
)

ISSUES = (
    "water quality", "the transit strike", "energy prices", "the Meridian Bank rumour",
    "the Northgate outage", "the harbour expansion", "the council budget", "the storm damage",
    "the Solvix supplement ads", "the AvaCoin promotion",
)
EVENTS = ("harbour festival", "farmers market", "transit rally", "marathon", "council protest")

FIRST = (
    "mira", "devon", "ana", "kai", "lena", "omar", "rhea", "theo", "isla", "noah", "zara", "luca",
    "maya", "eli", "nina", "ravi", "sofia", "jonas", "amara", "felix", "ines", "tomas", "yuki", "sam",
)
NOUNS = (
    "harbor", "signal", "ledger", "atlas", "beacon", "compass", "field", "lens", "north", "quill",
    "relay", "orbit", "pilot", "summit", "tide", "vector",
)
BOT_STEMS = ("truth", "patriot", "freedom", "alert", "insider", "awake", "realnews", "wakeup")


def _ip_address(index: int) -> str:
    prefix = ("198.51.100", "203.0.113", "192.0.2")[index % 3]
    return f"{prefix}.{(index * 7) % 200 + 10}"


def generate_dataset(now: datetime | None = None, seed: int = SEED) -> dict[str, Any]:
    """Return ``{"nodes": {label: {id: props}}, "edges": [...]}`` (timestamps are tz-aware)."""
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    rng = random.Random(seed)
    nodes: dict[str, dict[str, dict[str, Any]]] = {"User": {}, "Post": {}, "Hashtag": {}, "IPAddress": {}}
    edges: list[dict[str, Any]] = []
    edge_keys: set[tuple[str, str, str]] = set()

    def add_edge(source: str, target: str, relation: str, **properties: Any) -> None:
        key = (source, target, relation)
        if key not in edge_keys:
            edge_keys.add(key)
            edges.append({"source": source, "target": target, "type": relation, "properties": properties})

    hashtag_ids: dict[str, str] = {}

    def hashtag(tag: str) -> str:
        if tag not in hashtag_ids:
            hashtag_id = f"tag_{len(hashtag_ids) + 1:03d}"
            hashtag_ids[tag] = hashtag_id
            nodes["Hashtag"][hashtag_id] = {"id": hashtag_id, "tag": tag}
        return hashtag_ids[tag]

    for tag in ORGANIC_TAGS:
        hashtag(tag)

    def add_ip(ip_id: str, address: str, region: str, network_type: str) -> None:
        nodes["IPAddress"][ip_id] = {
            "id": ip_id, "address": address, "geo_region": region, "network_type": network_type,
        }

    # ---------------------------------------------------------------- organic accounts
    organic_count = TOTAL_USERS - sum(campaign.size for campaign in CAMPAIGNS)
    organic_ids: list[str] = []
    shared_nat = {  # benign shared infrastructure: user index -> NAT ip id
        **{i: "net_nat_campus" for i in (3, 47, 88, 121)},
        **{i: "net_nat_office" for i in (12, 64, 150)},
    }
    add_ip("net_nat_campus", "198.51.100.5", "US-EAST", "university")
    add_ip("net_nat_office", "203.0.113.5", "EU-WEST", "corporate")
    used_handles: set[str] = set()
    for index in range(organic_count):
        user_id = f"usr_{index + 1:03d}"
        while True:
            handle = rng.choice((
                f"@{rng.choice(FIRST)}_{rng.choice(NOUNS)}",
                f"@{rng.choice(FIRST)}.{rng.choice(NOUNS)}{rng.randint(1, 99)}",
                f"@{rng.choice(NOUNS)}{rng.choice(FIRST).title()}",
            ))
            if handle not in used_handles:
                used_handles.add(handle)
                break
        ip_id = shared_nat.get(index, f"net_{index + 1:03d}")
        if ip_id not in nodes["IPAddress"]:
            add_ip(ip_id, _ip_address(index), ("US-EAST", "EU-WEST", "APAC-SOUTH", "US-WEST")[index % 4], "residential")
        nodes["User"][user_id] = {
            "id": user_id,
            "handle": handle,
            "platform": PLATFORMS[index % len(PLATFORMS)],
            "created_at": now - timedelta(days=rng.randint(240, 3400)),
            "follower_count": int(rng.lognormvariate(6.2, 1.5)),
            "ip_hash": ip_id,
            "flagged": rng.random() < 0.04,
        }
        add_edge(user_id, ip_id, "POSTED_FROM", timestamp=now - timedelta(days=rng.randint(1, 30)))
        organic_ids.append(user_id)

    # ---------------------------------------------------------------- campaigns
    campaign_posts: list[tuple[str, str, datetime, float, str, list[str]]] = []
    campaign_members: dict[str, list[str]] = {}
    user_counter = organic_count
    for c_index, campaign in enumerate(CAMPAIGNS, start=1):
        ip_id = f"net_c{c_index:02d}"
        add_ip(ip_id, campaign.ip_address, campaign.geo_region, campaign.network_type)
        members = []
        for m_index in range(campaign.size):
            user_counter += 1
            user_id = f"usr_{user_counter:03d}"
            handle = f"@{rng.choice(BOT_STEMS)}_{rng.choice(NOUNS)}{rng.randint(1000, 9999)}"
            while handle in used_handles:
                handle = f"@{rng.choice(BOT_STEMS)}_{rng.choice(NOUNS)}{rng.randint(1000, 9999)}"
            used_handles.add(handle)
            is_origin = m_index == 0
            nodes["User"][user_id] = {
                "id": user_id,
                "handle": handle,
                "platform": campaign.platform,
                "created_at": now - timedelta(days=rng.randint(180, 400) if is_origin else rng.randint(6, 45)),
                "follower_count": rng.randint(1800, 9000) if is_origin else rng.randint(0, 60),
                "ip_hash": ip_id,
                "flagged": (not is_origin) and rng.random() < 0.7,
            }
            add_edge(user_id, ip_id, "POSTED_FROM", timestamp=now - timedelta(days=rng.randint(1, 5)))
            members.append(user_id)
        campaign_members[campaign.key] = members

        burst_start = now - timedelta(hours=campaign.hours_ago)
        step = campaign.burst_minutes / max(campaign.size * 1.4, 1)
        offset = 0.0
        post_number = 0
        for m_index, user_id in enumerate(members):
            for _ in range(1 if m_index == 0 or rng.random() < 0.6 else 2):
                post_number += 1
                post_id = f"pst_c{c_index:02d}_{post_number:02d}"
                timestamp = burst_start + timedelta(minutes=offset)
                offset = min(offset + step * rng.uniform(0.6, 1.4), campaign.burst_minutes)
                text = campaign.templates[0] if m_index == 0 else rng.choice(campaign.templates)
                severity = round(rng.uniform(0.86, 0.97) if m_index == 0 else rng.uniform(0.74, 0.95), 3)
                tags = [campaign.hashtag] + ([campaign.secondary_tag] if rng.random() < 0.5 else [])
                campaign_posts.append((post_id, user_id, timestamp, severity, text, tags))

    # ---------------------------------------------------------------- posts
    def add_post(post_id: str, author_id: str, timestamp: datetime, severity: float, text: str, tags: list[str]) -> None:
        nodes["Post"][post_id] = {
            "id": post_id,
            "text": text,
            "timestamp": timestamp,
            "platform": nodes["User"][author_id]["platform"],
            "severity": severity,
            "language": "en",
        }
        add_edge(author_id, post_id, "POSTED", timestamp=timestamp)
        for tag in dict.fromkeys(tags):
            add_edge(post_id, hashtag(tag), "MENTIONS")

    for post in campaign_posts:
        add_post(*post)

    # Benign coincidence: students behind one campus NAT posting about the same festival.
    festival_start = now - timedelta(days=4, hours=3)
    benign = (
        ("usr_004", "Photos from the harbour festival this morning, crowds are bigger than last year.", 0),
        ("usr_048", "The harbour festival food stalls are packed, go early if you can.", 14),
        ("usr_089", "Live music at the harbour festival main stage starts at noon.", 31),
    )
    for index, (author_id, text, minutes) in enumerate(benign, start=1):
        add_post(f"pst_b{index:02d}", author_id, festival_start + timedelta(minutes=minutes),
                 round(0.03 + index * 0.01, 3), text, ["#HarborFestival"])

    organic_post_ids: list[str] = []
    for index in range(TOTAL_POSTS - len(campaign_posts) - len(benign)):
        author_id = rng.choice(organic_ids)
        template, base_severity = rng.choice(ORGANIC_TEMPLATES)
        text = template.format(issue=rng.choice(ISSUES), event=rng.choice(EVENTS))
        severity = round(min(0.99, max(0.0, base_severity + rng.gauss(0, 0.12) + (rng.random() ** 6) * 0.5)), 3)
        timestamp = now - timedelta(minutes=rng.randint(5, WINDOW_DAYS * 24 * 60))
        post_id = f"pst_{index + 1:05d}"
        add_post(post_id, author_id, timestamp, severity, text, rng.sample(ORGANIC_TAGS, rng.randint(1, 2)))
        organic_post_ids.append(post_id)

    # ---------------------------------------------------------------- interactions
    for index, post_id in enumerate(organic_post_ids):
        post = nodes["Post"][post_id]
        if index % 9 == 0:
            retweeter = rng.choice(organic_ids)
            add_edge(retweeter, post_id, "RETWEETED", timestamp=min(now, post["timestamp"] + timedelta(minutes=rng.randint(2, 240))))
        if index > 20 and index % 13 == 0:
            parent_id = organic_post_ids[rng.randint(0, index - 1)]
            if nodes["Post"][parent_id]["timestamp"] < post["timestamp"]:
                add_edge(post_id, parent_id, "REPLIED_TO", timestamp=post["timestamp"])
        if index % 27 == 0:
            add_edge(post_id, rng.choice(organic_ids), "TAGGED_USER")

    for user_id in organic_ids:
        for followed in rng.sample(organic_ids, 5):
            if followed != user_id:
                add_edge(user_id, followed, "FOLLOWS")

    for c_index, campaign in enumerate(CAMPAIGNS, start=1):
        members = campaign_members[campaign.key]
        origin_post = f"pst_c{c_index:02d}_01"
        origin_time = nodes["Post"][origin_post]["timestamp"]
        for m_index, member in enumerate(members[1:], start=1):
            add_edge(member, origin_post, "RETWEETED", timestamp=min(now, origin_time + timedelta(minutes=m_index * 2 + 1)))
            add_edge(member, members[0], "FOLLOWS")
            add_edge(member, members[(m_index % (len(members) - 1)) + 1], "FOLLOWS")
        # A few organic users get fooled and amplify the campaign.
        for organic in rng.sample(organic_ids, 2):
            add_edge(organic, origin_post, "RETWEETED", timestamp=min(now, origin_time + timedelta(minutes=rng.randint(40, 300))))
        # Debunk replies from organic fact-checkers.
        debunk = organic_post_ids[(c_index * 37) % len(organic_post_ids)]
        add_edge(debunk, origin_post, "REPLIED_TO", timestamp=min(now, origin_time + timedelta(hours=3)))

    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------------------- live stream
def live_posts(now: datetime, rng: random.Random, user_ids: list[str], count: int = 2) -> list[dict[str, Any]]:
    """Organic posts for the optional live-stream simulator (see app/simulator.py)."""
    posts = []
    for _ in range(count):
        template, base = rng.choice(ORGANIC_TEMPLATES)
        posts.append({
            "id": f"pst_live_{now.strftime('%Y%m%d%H%M%S')}_{rng.randint(1000, 9999)}",
            "author_id": rng.choice(user_ids),
            "text": template.format(issue=rng.choice(ISSUES), event=rng.choice(EVENTS)),
            "timestamp": now,
            "severity": round(min(0.99, max(0.0, base + rng.gauss(0, 0.12))), 3),
            "language": "en",
            "hashtags": rng.sample(ORGANIC_TAGS, rng.randint(1, 2)),
        })
    return posts


# ---------------------------------------------------------------------- live demo burst
DEMO_TEMPLATES = (
    "[DEMO] URGENT: the Harbour Line bridge is closing tonight for 'repairs'. Leave the city now and share this!",
    "[DEMO] URGENT!! Harbour Line bridge closing TONIGHT for repairs - leave the city now, share this",
    "[DEMO] The Harbour Line bridge closes tonight. They call it repairs. Leave now and share before it's removed.",
)


def demo_burst(platform: str, now: datetime | None = None, rng: random.Random | None = None) -> dict[str, Any]:
    """A fresh coordinated burst for ``POST /demo/coordination`` (live walkthrough).

    Ten new accounts on one datacenter IP post near-identical text under a new hashtag
    within ~6 minutes ending *now*, then retweet the seeding post. Text is prefixed with
    "[DEMO]" so injected data can never be mistaken for the seeded dataset.
    """
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    rng = rng or random.Random()
    scenario = f"{rng.getrandbits(40):010x}"
    ip_id, hashtag_id = f"demo_ip_{scenario}", f"demo_tag_{scenario}"
    address = f"192.0.2.{1 + int(scenario[:4], 16) % 254}"
    tag = f"#DemoBurst{scenario[:6]}"
    start = now - timedelta(minutes=6)
    users, posts, edges = [], [], []

    for index in range(10):
        user_id = f"demo_user_{scenario}_{index + 1:02d}"
        post_id = f"demo_post_{scenario}_{index + 1:02d}"
        posted_at = start + timedelta(seconds=index * 34 + rng.randint(0, 15))
        users.append({
            "id": user_id,
            "handle": f"@{rng.choice(BOT_STEMS)}_{rng.choice(NOUNS)}{rng.randint(1000, 9999)}",
            "platform": platform,
            "created_at": now - timedelta(days=rng.randint(3, 20)),
            "follower_count": rng.randint(0, 40),
            "ip_hash": ip_id,
            "flagged": index > 0 and rng.random() < 0.5,
        })
        posts.append({
            "id": post_id,
            "text": DEMO_TEMPLATES[0] if index == 0 else rng.choice(DEMO_TEMPLATES),
            "timestamp": posted_at,
            "platform": platform,
            "severity": round(rng.uniform(0.82, 0.95), 3),
            "language": "en",
        })
        edges += [
            {"source": user_id, "target": ip_id, "type": "POSTED_FROM", "properties": {"timestamp": start}},
            {"source": user_id, "target": post_id, "type": "POSTED", "properties": {"timestamp": posted_at}},
            {"source": post_id, "target": hashtag_id, "type": "MENTIONS", "properties": {}},
        ]
    origin = posts[0]["id"]
    for index, user in enumerate(users[1:], start=1):
        edges.append({"source": user["id"], "target": origin, "type": "RETWEETED",
                      "properties": {"timestamp": min(now, posts[0]["timestamp"] + timedelta(seconds=30 * index))}})

    times = [post["timestamp"] for post in posts]
    return {
        "ip": {"id": ip_id, "address": address, "geo_region": "SIMULATED-NETWORK", "network_type": "datacenter"},
        "hashtag": {"id": hashtag_id, "tag": tag},
        "users": users,
        "posts": posts,
        "edges": edges,
        "result": {
            "scenario_id": scenario,
            "shared_ip": address,
            "hashtag": tag,
            "platform": platform,
            "accounts_created": len(users),
            "posts_created": len(posts),
            "window_seconds": int((max(times) - min(times)).total_seconds()),
            "user_ids": [user["id"] for user in users],
            "post_ids": [post["id"] for post in posts],
        },
    }
