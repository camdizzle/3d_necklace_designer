// Parametric Necklace Pendant Designer for MakerWorld
// Generated from Chain Studio 3D Necklace Designer
// https://github.com/camdizzle/3d_necklace_designer

/* [Text - Line 1] */
line1_text = "Love";
line1_size = 10; // [4:1:30]
line1_depth = 3; // [1:0.5:10]
line1_offset_x = 0; // [-20:0.5:20]
line1_offset_y = 0; // [-20:0.5:20]
line1_spacing = 0; // [-3:0.5:5]

/* [Text - Line 2] */
line2_text = "";
line2_size = 8; // [4:1:24]
line2_depth = 3; // [1:0.5:10]
line2_offset_x = 0; // [-20:0.5:20]
line2_offset_y = 0; // [-20:0.5:20]
line2_spacing = 0; // [-3:0.5:5]

/* [Text - Line 3] */
line3_text = "";
line3_size = 6; // [4:1:20]
line3_depth = 3; // [1:0.5:10]
line3_offset_x = 0; // [-20:0.5:20]
line3_offset_y = 0; // [-20:0.5:20]
line3_spacing = 0; // [-3:0.5:5]

/* [Plate] */
// Shape of the pendant plate
pendant_shape = "rectangle"; // [rectangle, circle, oval, diamond, heart, shield, star]
plate_padding = 5; // [2:0.5:15]
plate_thickness = 3; // [1:0.5:8]
corner_radius = 3; // [0:0.5:15]
// Lock plate to specific width (0 = auto)
fixed_width = 0; // [0:1:100]
// Lock plate to specific height (0 = auto)
fixed_height = 0; // [0:1:100]

/* [Border] */
border_width = 0; // [0:0.5:8]
border_protrusion = 1.5; // [0.5:0.25:4]

/* [Bail (Loop)] */
// Bail connects pendant to chain
bail_enabled = true;
bail_width = 6; // [3:0.5:12]
bail_height = 8; // [4:0.5:15]
bail_thickness = 2; // [1:0.5:4]
bail_inner_width = 3; // [1:0.5:10]
bail_inner_height = 5; // [2:0.5:12]

/* [Style] */
engrave = false;
line_gap_factor = 1.0; // [0.5:0.1:2.0]
text_font = "Liberation Sans:style=Bold";

/* [Hidden] */
$fn = 64;

module pendant() {
    plate_dims = compute_plate_size();
    pw = plate_dims[0];
    ph = plate_dims[1];

    // Plate
    plate(pw, ph);

    // Border
    if (border_width > 0)
        border(pw, ph);

    // Text lines
    text_lines(pw, ph);

    // Bail
    if (bail_enabled)
        translate([0, ph/2 + (border_width > 0 ? border_width : 0), 0])
            bail();
}

function compute_text_height() =
    let(
        h1 = len(line1_text) > 0 ? line1_size : 0,
        h2 = len(line2_text) > 0 ? line2_size : 0,
        h3 = len(line3_text) > 0 ? line3_size : 0,
        gap = line1_size * 0.3 * line_gap_factor,
        lines = (h1 > 0 ? 1 : 0) + (h2 > 0 ? 1 : 0) + (h3 > 0 ? 1 : 0),
        gaps = max(0, lines - 1)
    ) h1 + h2 + h3 + gaps * gap;

function compute_text_width() =
    let(
        w1 = len(line1_text) > 0 ? len(line1_text) * line1_size * 0.65 + line1_spacing * max(0, len(line1_text) - 1) : 0,
        w2 = len(line2_text) > 0 ? len(line2_text) * line2_size * 0.65 + line2_spacing * max(0, len(line2_text) - 1) : 0,
        w3 = len(line3_text) > 0 ? len(line3_text) * line3_size * 0.65 + line3_spacing * max(0, len(line3_text) - 1) : 0
    ) max(w1, w2, w3);

function compute_plate_size() =
    let(
        tw = compute_text_width(),
        th = compute_text_height(),
        raw_w = fixed_width > 0 ? fixed_width : tw + plate_padding * 2,
        raw_h = fixed_height > 0 ? fixed_height : th + plate_padding * 2
    )
    pendant_shape == "circle" ? let(r = max(raw_w, raw_h)) [r, r] :
    [max(raw_w, 10), max(raw_h, 10)];

module plate_shape_2d(w, h) {
    if (pendant_shape == "circle") {
        circle(d = max(w, h));
    } else if (pendant_shape == "oval") {
        scale([1, h/w]) circle(d = w);
    } else if (pendant_shape == "diamond") {
        polygon([[0, h/2], [w/2, 0], [0, -h/2], [-w/2, 0]]);
    } else if (pendant_shape == "heart") {
        heart_2d(max(w, h) / 2);
    } else if (pendant_shape == "shield") {
        shield_2d(w, h);
    } else if (pendant_shape == "star") {
        star_2d(max(w, h) / 2);
    } else {
        // rectangle with rounded corners
        r = min(corner_radius, w/2, h/2);
        if (r > 0.01) {
            offset(r) offset(-r)
                square([w, h], center = true);
        } else {
            square([w, h], center = true);
        }
    }
}

module heart_2d(s) {
    // Approximate heart from two circles and a triangle
    hull() {
        translate([-s*0.35, s*0.15]) circle(r = s*0.45);
        translate([s*0.35, s*0.15]) circle(r = s*0.45);
        translate([0, -s*0.7]) circle(r = s*0.1);
    }
}

module shield_2d(w, h) {
    hw = w / 2;
    hh = h / 2;
    hull() {
        // Top flat edge
        translate([-hw + 2, hh - 2]) circle(r = 2);
        translate([hw - 2, hh - 2]) circle(r = 2);
        // Bottom point
        translate([0, -hh]) circle(r = 1);
        // Side bulge
        translate([-hw + 2, 0]) circle(r = 2);
        translate([hw - 2, 0]) circle(r = 2);
    }
}

module star_2d(r) {
    outer = r;
    inner = r * 0.45;
    points = [for (i = [0:9])
        let(
            angle = i * 36 - 90,
            rad = i % 2 == 0 ? outer : inner
        )
        [cos(angle) * rad, sin(angle) * rad]
    ];
    polygon(points);
}

module plate(w, h) {
    // Main plate with bevel effect
    hull() {
        // Back face - full size
        linear_extrude(0.01)
            plate_shape_2d(w, h);
        // Front face - slightly inset for subtle bevel
        translate([0, 0, plate_thickness - 0.01])
            linear_extrude(0.01)
                plate_shape_2d(w, h);
    }
}

module border(w, h) {
    bw = border_width;
    difference() {
        // Outer shape
        hull() {
            linear_extrude(0.01)
                plate_shape_2d(w + bw * 2, h + bw * 2);
            translate([0, 0, plate_thickness + border_protrusion - 0.01])
                linear_extrude(0.01)
                    plate_shape_2d(w + bw * 2, h + bw * 2);
        }
        // Inner cutout (same as plate)
        translate([0, 0, -0.1])
            linear_extrude(plate_thickness + border_protrusion + 0.2)
                plate_shape_2d(w, h);
    }
}

module text_lines(pw, ph) {
    gap = line1_size * 0.3 * line_gap_factor;

    sizes = [line1_size, line2_size, line3_size];
    depths = [line1_depth, line2_depth, line3_depth];
    texts = [line1_text, line2_text, line3_text];
    offx = [line1_offset_x, line2_offset_x, line3_offset_x];
    offy = [line1_offset_y, line2_offset_y, line3_offset_y];
    spacings = [line1_spacing, line2_spacing, line3_spacing];

    // Collect active lines
    active = [for (i = [0:2]) if (len(texts[i]) > 0) i];
    n = len(active);

    if (n > 0) {
        // Total text height for vertical centering
        total_h = compute_text_height();
        start_y = total_h / 2;

        for (j = [0 : n - 1]) {
            i = active[j];
            // Y position: stack from top
            preceding_h = (j == 0) ? 0 :
                let(acc = [for (k = [0 : j - 1])
                    sizes[active[k]] + (k < j - 1 ? gap : 0)])
                _sum(acc) + gap;

            y_pos = start_y - preceding_h - sizes[i] / 2;

            if (engrave) {
                translate([offx[i], y_pos + offy[i], plate_thickness - depths[i] + 0.3])
                    render_text_line(texts[i], sizes[i], depths[i], spacings[i]);
            } else {
                translate([offx[i], y_pos + offy[i], plate_thickness])
                    render_text_line(texts[i], sizes[i], depths[i], spacings[i]);
            }
        }
    }
}

function _sum(v, i = 0) = i >= len(v) ? 0 : v[i] + _sum(v, i + 1);

module render_text_line(txt, size, depth, spacing) {
    if (spacing != 0) {
        // Manual character spacing
        char_w = size * 0.65;
        total_w = len(txt) * char_w + (len(txt) - 1) * spacing;
        for (i = [0 : len(txt) - 1]) {
            x = -total_w / 2 + i * (char_w + spacing) + char_w / 2;
            translate([x, 0, 0])
                linear_extrude(depth)
                    text(txt[i], size = size, font = text_font,
                         halign = "center", valign = "center");
        }
    } else {
        linear_extrude(depth)
            text(txt, size = size, font = text_font,
                 halign = "center", valign = "center");
    }
}

module bail() {
    // Bail lies in the XY plane with thickness along Z, centered on Z
    translate([0, 0, -bail_thickness/2])
    difference() {
        // Outer rounded rectangle
        hull() {
            translate([-bail_width/2 + bail_thickness/2, 0, 0])
                cylinder(d = bail_thickness, h = bail_thickness);
            translate([bail_width/2 - bail_thickness/2, 0, 0])
                cylinder(d = bail_thickness, h = bail_thickness);
            translate([-bail_width/2 + bail_thickness/2, bail_height - bail_thickness/2, 0])
                cylinder(d = bail_thickness, h = bail_thickness);
            translate([bail_width/2 - bail_thickness/2, bail_height - bail_thickness/2, 0])
                cylinder(d = bail_thickness, h = bail_thickness);
        }

        // Inner hole for chain to pass through
        iw = bail_inner_width / 2;
        ih = bail_inner_height;
        wall = (bail_width - bail_inner_width) / 2;
        translate([0, wall + ih/2, -0.1])
            hull() {
                translate([-iw, -ih/2, 0]) cylinder(d = 0.5, h = bail_thickness + 0.2);
                translate([iw, -ih/2, 0]) cylinder(d = 0.5, h = bail_thickness + 0.2);
                translate([-iw, ih/2, 0]) cylinder(d = 0.5, h = bail_thickness + 0.2);
                translate([iw, ih/2, 0]) cylinder(d = 0.5, h = bail_thickness + 0.2);
            }
    }
}

// Render the pendant
pendant();
