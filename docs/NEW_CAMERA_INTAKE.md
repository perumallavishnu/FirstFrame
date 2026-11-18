# New camera intake: prompts and folder

Use this to gather everything Claude needs to build an accurate 3D model and tutorials for a new camera.
1. Replace the three placeholders everywhere:
   - `{{MAKER}}`, for example `Nikon`;
   - `{{MODEL}}`, for example `Z50 II`;
   - `{{CAMERA_ID}}`: lowercase with dashes, for example `nikon-z50-ii`.
2. Run the prompts in order.
3. Save each answer under the file name shown, in `intake/{{CAMERA_ID}}/`.
4. In Claude Code, say: **"Build the {{MAKER}} {{MODEL}} from intake/{{CAMERA_ID}}"**. The `camera-model-builder` skill takes it from there.

## Which tool runs which prompt
| Step | Tool | Why |
|------|------|-----|
| A. Research prompts 1–7 | An AI with live web browsing and citations (Claude with web search, ChatGPT deep research, Perplexity, Gemini deep research) | These collect facts from the maker's manual and spec pages. Every value must carry a source link. |
| B. Official photos | You, in a browser, downloading from the maker's own site | The model is measured from these, so they must be real photos of the real camera. |
| C. Image prompts | An image model (Higgsfield, Midjourney, GPT-image, and so on) | **Tutorial illustrations only.** Never used to shape the model. See "Why not AI images for the model" below. |

## Folder you hand over
```
intake/{{CAMERA_ID}}/
  01_sources.json      research prompt 1
  02_specs.json        research prompt 2
  03_parts.json        research prompt 3
  04_menus.json        research prompt 4
  05_controls.json     research prompt 5
  06_hardware.json     research prompt 6
  07_lenses.json       research prompt 7
  photos/              official product photos (step B), named as listed below
  manual/              the official PDF manual, plus screenshots of the part-names pages
  tutorial_art/        optional image-model output (step C)
  NOTES.md             anything odd you noticed (region differences, firmware version)
```
`intake/` is git-ignored because it holds the maker's copyrighted photos and manual. Claude turns the facts into the app's own data files and keeps the photos out of git.

---

## Step A: research prompts (run in this order)

Paste the **ground rules** block at the top of every research prompt. It is what stops the AI from making things up.

### Ground rules (prepend to prompts 1–7)
```
You are collecting reference data for an accurate 3D model and beginner tutorials of the {{MAKER}} {{MODEL}} camera.
Rules:
- Use only official {{MAKER}} sources: the online or PDF instruction manual, the official specifications page, the official product page, official firmware notes. Use a reputable review site only when the official sources are silent, and label it "secondary".
- Every value needs "source_url" (and the manual page or section when there is one).
- Copy names exactly as {{MAKER}} prints them (capitalisation, punctuation, abbreviations). Don't paraphrase official names.
- If you cannot find something, write "NOT FOUND". Never estimate, never fill in from a similar model, never invent.
- If regions or firmware versions differ, list each variant separately and say which you used.
- Output only valid JSON in the schema given, no commentary outside it.
```

### Prompt 1: identify the camera and its sources → `01_sources.json`
```
Identify exactly which camera "{{MAKER}} {{MODEL}}" is and list every official source for it.
Schema:
{
  "maker": "", "model": "", "also_known_as": [], "announced": "YYYY-MM", "product_codes": [{"code":"", "region":"", "kit":""}],
  "predecessor": "", "successor": "", "easily_confused_with": [{"model":"", "how_to_tell_apart":""}],
  "current_firmware": {"version":"", "date":"", "source_url":""},
  "sources": {
    "manual_online_url": "", "manual_pdf_url": "", "manual_language": "", "manual_version": "",
    "part_names_page_url": "", "menu_list_page_url": "", "battery_card_insert_page_url": "", "terminals_page_url": "",
    "specifications_url": "", "product_page_url": "",
    "official_gallery_urls": [{"url":"", "shows":"front|rear|top|bottom|left|right|three-quarter|with-lens"}],
    "kit_lens_pages": [{"lens":"", "url":""}],
    "accessory_pages": [{"accessory":"", "url":""}]
  }
}
```

### Prompt 2: specifications → `02_specs.json`
```
List the full official specifications of the {{MAKER}} {{MODEL}}.
For each field give {"value":"", "unit":"", "source_url":"", "note":""}.
Fields: dimensions_w_h_d_mm (and exactly what the depth includes, such as the grip, eyecup or monitor), weight_body_only_g, weight_with_battery_card_g,
mount (name), flange_distance_mm, sensor_type, sensor_size_mm, effective_megapixels, image_size_px, crop_factor,
ibis (yes/no and stops), shutter_type, shutter_speed_range, flash_sync_speed, electronic_shutter_range,
iso_range_native, iso_range_expanded, metering_modes, metering_range_ev, exposure_compensation_range_and_step,
af_system, af_points_or_zones, af_low_light_limit_ev (and the aperture it is measured at), subject_detection,
burst_fps (per shutter / AF mode), buffer_jpeg, buffer_raw,
viewfinder (type, dots, coverage, magnification, eyepoint), monitor (size, dots, articulation, touch yes/no),
built_in_flash (yes/no, guide number at ISO 100 in metres, coverage), hot_shoe (type and pins),
video_modes (resolution, frame rates, crop), mic_built_in (mono/stereo), mic_input, headphone_output,
ports (every terminal with connector type), wireless (Wi-Fi, Bluetooth versions),
battery (model, voltage, mAh, CIPA shots for viewfinder and monitor), usb_charging (yes/no), card_slots (count, type, UHS class),
weather_sealing, operating_temperature, materials (body shell).
```

### Prompt 3: every external part → `03_parts.json`
```
From the official manual's "Part Names" / "Nomenclature" pages, list every numbered item on every diagram (front, rear, top, bottom, left side, right side, inside the battery/card compartment, the lens, the mode dial, and any screen-information diagrams that name physical parts).
For each item:
{
  "diagram": "front|rear|top|bottom|left|right|battery-compartment|lens|mode-dial",
  "number_on_diagram": 0,
  "official_name": "",                 // exact wording
  "printed_marking": "",               // the text or icon printed on or next to it, described in words; "" if none
  "kind": "button|dial|lever|switch|cover|door|port|lamp|window|mount|contact|label|mark|socket|speaker|mic|other",
  "functions": [{"name":"", "when":""}], // every function named in the manual, e.g. a button that is also an arrow key
  "moves": "none|press|half-press|rotate (clicks?)|slide|hinge|pop-up|tilt",
  "where": "",                          // position in words: e.g. "top plate, right of the mode dial, behind the shutter button"
  "colour_or_finish": "",               // e.g. red dot, silver ring, rubber
  "source_url": "", "manual_page": ""
}
Also list:
- "mode_dial_positions": every position in physical order, clockwise seen from above, with the exact printed label or icon description;
- "things_this_camera_does_NOT_have": common features it lacks (touch screen, joystick, IBIS, headphone jack, second card slot, top LCD, and so on), each with a source;
- "port_layout": which side each port is on, top-to-bottom order, which cover each sits behind.
```

### Prompt 4: the complete menu → `04_menus.json`
```
List the complete menu system of the {{MAKER}} {{MODEL}} on firmware {{FIRMWARE or "the latest"}}, from the manual's menu list ("Menu Item Settings", "Menu Functions" or similar).
Keep the exact on-screen order: tab, then page, then item.
Schema:
{
  "firmware": "", "menu_display_modes": ["e.g. Guided / Standard"], "source_url": "",
  "tabs": [
    {"id":"shoot", "official_name":"", "icon_description":"", "colour":"",
     "pages": [
       {"page_number":1, "items": [
         {"name":"",                        // exact on-screen wording
          "options":[""],                   // every option in on-screen order; [] if the item opens a sub-screen or runs an action
          "default":"",                     // factory default
          "submenu":[ /* same item shape, for nested screens */ ],
          "available_in_modes":["P","Tv","Av","M","Auto",...], // "all" if not restricted
          "greyed_out_when":"",             // conditions that disable it
          "what_it_does":"",                // one plain sentence from the manual
          "manual_page":""}
       ]}
     ]}
  ],
  "quick_menu": {"button":"", "items_in_order":[{"name":"", "options":[""], "available_in_modes":[]}]},
  "my_menu": {"supported": true, "max_tabs": 0},
  "firmware_changes": [{"version":"", "menu_changes":[""], "source_url":""}]
}
Do not skip items because they seem advanced. List every option value exactly, for example every white balance preset and every ISO step.
```

### Prompt 5: how the controls behave → `05_controls.json`
```
Describe what each physical control does in each situation on the {{MAKER}} {{MODEL}}, from the manual.
Schema:
{
  "shooting": [ {"control":"", "mode":"P|Tv|Av|M|Auto|Scene|Movie|...", "action":"turn|press|hold|press+turn", "result":""} ],
  "playback": [ {"control":"", "action":"", "result":""} ],
  "menu_navigation": [ {"control":"", "action":"", "result":""} ],
  "exposure_in_M": {"shutter_set_by":"", "aperture_set_by":"", "iso_set_by":""},
  "shooting_screen_info": [ {"element":"", "meaning":""} ],      // what the live view / viewfinder display shows
  "viewfinder_vs_monitor_switching": "",
  "custom_buttons": [ {"button":"", "default_function":"", "assignable_options":[""]} ],
  "power_on_defaults": "",
  "beginner_tasks": [ {"task":"e.g. Format a card", "steps":["exact button / menu path"], "manual_page":""} ]
}
For beginner_tasks cover at least: insert battery and card, set date and time, format card, choose Av and change aperture, Tv and shutter speed, M exposure, set ISO, exposure compensation, change focus mode, choose AF area, single vs continuous drive, self-timer, raise or attach a flash, choose image quality and RAW, white balance, review and delete a photo, record a movie, transfer photos, reset settings.
```

### Prompt 6: battery, card, ports, accessories → `06_hardware.json`
```
Give exact physical details of the {{MAKER}} {{MODEL}}'s removable and connectable hardware.
{
  "battery": {"model":"", "dimensions_mm":"", "weight_g":"", "voltage":"", "capacity_mAh":"", "contacts_count":0, "contacts_side":"", "insert_orientation":"exact words from the manual: which way the contacts and label face", "lock_mechanism":"", "source_url":""},
  "card": {"type":"", "max_speed_class":"", "insert_orientation":"which way the label faces, which edge goes in first", "slot_location":"", "source_url":""},
  "compartment": {"door_location":"", "door_opens_how":"", "shared_battery_card":true},
  "ports": [{"official_name":"", "connector_standard":"e.g. USB Type-C, HDMI micro (Type D), 3.5 mm stereo mini jack", "side":"", "under_cover":"", "purpose":""}],
  "hot_shoe": {"type":"", "pins":"", "compatible_flashes":[""]},
  "built_in_flash": {"exists":true, "how_raised":"button / by hand / none", "guide_number_iso100_m":0},
  "tripod_socket": {"thread":"1/4-20", "position":"on lens axis?"},
  "strap_lugs": {"type":"", "count":0},
  "official_accessories": [{"name":"", "type":"flash|grip|charger|remote|eyecup|other", "dimensions_mm":"", "weight_g":"", "key_specs":"", "url":""}]
}
```

### Prompt 7: lenses → `07_lenses.json`
```
List the kit lens(es) sold with the {{MAKER}} {{MODEL}}, plus the 5–8 lenses most recommended to beginners for this mount (a fast prime, a wide, a telephoto, a macro, a portrait prime).
For each: {"name":"exact official name", "mount":"", "focal_length":"", "max_aperture":"", "min_aperture":"", "diameter_mm":0, "length_mm":0, "length_note":"retracted? from mount flange?", "weight_g":0, "filter_mm":0, "min_focus_m":0, "max_magnification":"", "stabilised":"yes/no, stops", "aperture_blades":0, "elements_groups":"", "rings":"zoom ring / focus ring / control ring, front to back", "switches":[""], "retracting_mechanism":"yes/no and how it unlocks", "spec_url":"", "official_side_photo_url":""}
```

---

## Step B: official photos to download → `photos/`

Download from the maker's own product page or gallery, at the largest size offered. Don't use retailer or review photos. Open the image in a new tab and look for a larger version: changing `w=` or a size number in the URL often works. Name them exactly like this:

| File | What it must show |
|------|-------------------|
| `body_front.jpg` | Straight-on front, body only (no lens, or body cap), whole camera in frame |
| `body_rear.jpg` | Straight-on back |
| `body_top.jpg` | Straight down from above |
| `body_bottom.jpg` | Straight up from below (tripod socket, battery door) |
| `body_left.jpg` | Side with the ports or terminal covers |
| `body_right.jpg` | Grip side (card door if it is on the side) |
| `body_34.jpg` | Any three-quarter view (used only for checking) |
| `with_kit_lens_*.jpg` | Any views with the kit lens fitted |
| `lens_<name>_side.jpg` | Each lens, straight side view |
| `accessory_<name>_*.jpg` | Each accessory (flash, grip) from its own page |
| `manual_part_names_*.png` | Screenshots of the manual's part-names diagrams |
| `manual_battery_card.png` | The manual's battery and card insertion diagram |

Check each photo: straight-on (no visible top surface in a front view), plain background, nothing cropped off. If the maker has no straight view for a side, write that in `NOTES.md`; don't substitute something else.

---

## Step C: image-model prompts (tutorial art only, optional) → `tutorial_art/`

These make friendly pictures for lessons. Claude never uses them to measure or shape the 3D model, and the app labels them as illustrations.

```
Clean educational illustration for a beginner photography lesson: a hand holding a generic mirrorless camera, finger half-pressing the shutter button, soft studio light, flat pastel background, no brand names, no logos, no readable text, 3:2.
```
```
Simple diagram-style illustration of the exposure triangle (aperture, shutter speed, ISO) using icons only, no text, consistent flat style, white background.
```
```
Before/after pair: the same street scene photographed at a fast shutter speed (frozen cyclist) and a slow shutter speed (motion-blurred cyclist), realistic photo style, no text, 3:2 each.
```
Replace the subject for each lesson (depth of field portrait, low-light ISO noise, white balance warm/cool, and so on). Keep "no brand names, no logos, no readable text", because image models garble text and invent camera branding.

---

## Why not AI images for the model
The model's accuracy (size within 1 mm, outline matching the real photos at 92% or better) comes from measuring six straight views of one real object. Image models invent their output:
- buttons move between generations;
- port shapes are made up;
- text and icons come out garbled;
- the six views never agree on size.

A model built from them would look plausible and be wrong, which defeats the point of an app people use to learn a camera before buying it. So official photos shape the model, and AI images only decorate lessons.

## What Claude does with the folder
1. Checks every JSON for "NOT FOUND" items and missing sources, and reports gaps before modelling.
2. Turns `03_parts.json` into the camera profile registry, and `04_menus.json` / `05_controls.json` into the camera's menu data and simulator behaviour.
3. Measures the photos and builds and validates the model (see `.claude/skills/camera-model-builder/SKILL.md`).
4. Writes the camera's tutorials from `05_controls.json` `beginner_tasks` and the specs, each linked to its manual page.
