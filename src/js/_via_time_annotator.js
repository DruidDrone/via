/**
 * @class
 * @classdesc Marks time segments of a {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement|HTMLMediaElement}
 * @author Abhishek Dutta <adutta@robots.ox.ac.uk>
 * @since 22 Jan. 2019
 * @fires _via_time_annotator#segment_add
 * @fires _via_time_annotator#segment_del
 * @fires _via_time_annotator#segment_edit
 * @param {Element} container HTML container element like <div>
 * @param {HTMLMediaElement} media_element HTML video of audio
 */

'use strict';

function _via_time_annotator(container, file, data, media_element) {
  this.c = container;
  this.file = file;
  this.d = data;
  this.m = media_element;

  // registers on_event(), emit_event(), ... methods from
  // _via_event to let this module listen and emit events
  this._EVENT_ID_PREFIX = '_via_time_annotator_';
  _via_event.call( this );

  if ( ! this.m instanceof HTMLMediaElement ) {
    throw 'media element must be an instance of HTMLMediaElement!';
  }

  // constants
  this.METADATA_COLOR_LIST = ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7"];
  this.PLAYBACK_MODE = { NORMAL:'1', REVIEW:'2', ANNOTATION:'3' };

  // state
  this.tseg_timeline_tstart = -1; // boundary of current timeline visible in temporal seg.
  this.tseg_timeline_tend   = -1;
  this.tseg_metadata_mid_list = [];
  this.tseg_metadata_time_list = [];
  this.tseg_metadata_label_list = [];
  this.tseg_metadata_sel_mindex = -1; // metadata index in this.tseg_metadata_mid_list
  this.tseg_metadata_sel_bindex = -1; // 0=>left boundary, 1=>right boundary
  this.tseg_is_metadata_resize_ongoing = false;
  this.tseg_is_metadata_selected = false;

  this.current_playback_mode = this.PLAYBACK_MODE.NORMAL;
}

_via_time_annotator.prototype._init = function() {
  try {
    this.thumbnail_container = document.createElement('div');
    this.thumbnail_container.setAttribute('class', 'thumbnail_container');
    this.thumbnail_container.setAttribute('style', 'display:none; position:absolute; top:0; left:0;');
    this.c.appendChild(this.thumbnail_container);

    try {
      this.thumbnail = new _via_video_thumbnail(this.file);
      this.thumbnail.start();
      this._vtimeline_init();
      this._tseg_init();
      this._toolbar_init();
    } catch(err) {
      console.log(err)
    }
  } catch(err) {
    console.log(err)
  }
}

//
// toolbar
//
_via_time_annotator.prototype._toolbar_init = function() {
  var toolbar_container = document.createElement('div');
  toolbar_container.setAttribute('class', 'toolbar_container');

  var pb_mode_container = document.createElement('div');
  var pb_mode_label = document.createElement('span');
  pb_mode_label.innerHTML = 'Playback Mode:';
  pb_mode_container.appendChild(pb_mode_label);

  var pb_normal = document.createElement('input');
  pb_normal.setAttribute('type', 'radio');
  pb_normal.setAttribute('id', 'playback_mode_normal');
  pb_normal.setAttribute('name', 'via_time_annotator_playback_mode');
  pb_normal.setAttribute('value', this.PLAYBACK_MODE.NORMAL);
  pb_normal.setAttribute('checked', '');
  pb_normal.addEventListener('change', this._toolbar_playback_mode_on_change.bind(this));
  pb_mode_container.appendChild(pb_normal);
  var pb_normal_label = document.createElement('label');
  pb_normal_label.setAttribute('for', 'playback_mode_normal');
  pb_normal_label.innerHTML = 'Normal';
  pb_mode_container.appendChild(pb_normal_label);

  var pb_review = document.createElement('input');
  pb_review.setAttribute('type', 'radio');
  pb_review.setAttribute('id', 'playback_mode_review');
  pb_review.setAttribute('name', 'via_time_annotator_playback_mode');
  pb_review.setAttribute('value', this.PLAYBACK_MODE.REVIEW);
  pb_review.addEventListener('change', this._toolbar_playback_mode_on_change.bind(this));
  pb_mode_container.appendChild(pb_review);
  var pb_review_label = document.createElement('label');
  pb_review_label.setAttribute('for', 'playback_mode_review');
  pb_review_label.innerHTML = 'Review';
  pb_mode_container.appendChild(pb_review_label);

  var pb_annotation = document.createElement('input');
  pb_annotation.setAttribute('type', 'radio');
  pb_annotation.setAttribute('id', 'playback_mode_annotation');
  pb_annotation.setAttribute('name', 'via_time_annotator_playback_mode');
  pb_annotation.setAttribute('value', this.PLAYBACK_MODE.ANNOTATION);
  pb_annotation.addEventListener('change', this._toolbar_playback_mode_on_change.bind(this));
  pb_mode_container.appendChild(pb_annotation);
  var pb_annotation_label = document.createElement('label');
  pb_annotation_label.setAttribute('for', 'playback_mode_annotation');
  pb_annotation_label.innerHTML = 'Annotation';
  pb_mode_container.appendChild(pb_annotation_label);

  toolbar_container.appendChild(pb_mode_container);
  this.c.appendChild(toolbar_container);
}

_via_time_annotator.prototype._toolbar_playback_mode_on_change = function(e) {
  this.current_playback_mode = e.target.value;
}

//
// full timeline
//
_via_time_annotator.prototype._vtimeline_time2canvas = function(t) {
  return Math.floor( ( ( this.timelinew * t ) / this.m.duration ) + this.padx );
}

_via_time_annotator.prototype._vtimeline_canvas2time = function(x) {
  var t = ( ( x - this.padx ) / this.timelinew ) * this.m.duration;
  return Math.max(0, Math.min(t, this.m.duration) );
}

_via_time_annotator.prototype._vtimeline_time2str = function(t) {
  var hh = Math.floor(t / 3600);
  var mm = Math.floor( (t - hh * 3600) / 60 );
  var ss = Math.round( t - hh*3600 - mm*60 );
  if ( hh < 10 ) {
    hh = '0' + hh;
  }
  if ( mm < 10 ) {
    mm = '0' + mm;
  }
  if ( ss < 10 ) {
    ss = '0' + ss;
  }
  return hh + ':' + mm + ':' + ss;
}

_via_time_annotator.prototype._vtimeline_time2strms = function(t) {
  var hh = Math.floor(t / 3600);
  var mm = Math.floor( (t - hh * 3600) / 60 );
  var ss = Math.floor( t - hh*3600 - mm*60 );
  var ms = Math.floor( (t - Math.floor(t) ) * 1000 );
  if ( hh < 10 ) {
    hh = '0' + hh;
  }
  if ( mm < 10 ) {
    mm = '0' + mm;
  }
  if ( ss < 10 ) {
    ss = '0' + ss;
  }
  if ( ms < 100 ) {
    ms = '0' + ms;
  }
  return hh + ':' + mm + ':' + ss + '.' + ms;
}

//
// Video Timeline
//
_via_time_annotator.prototype._vtimeline_init = function() {
  //// video timeline
  this.vtimeline = document.createElement('canvas');
  this.vtimeline.setAttribute('class', 'video_timeline');
  this.vtimeline.style.cursor = 'pointer';
  this.vtimeline.addEventListener('mousedown', this._vtimeline_on_mousedown.bind(this));
  this.vtimeline.addEventListener('mousemove', this._vtimeline_on_mousemove.bind(this));
  this.vtimeline.addEventListener('mouseout', this._vtimeline_on_mouseout.bind(this));

  var ctx = this.vtimeline.getContext('2d', {alpha:false});
  ctx.font = '10px Sans';
  this.char_width = ctx.measureText('M').width;
  this.vtimeline.width = this.c.clientWidth;
  this.vtimeline.height = Math.floor(2*this.char_width);
  this.padx = this.char_width;
  this.pady = this.char_width;
  this.lineh = this.char_width;
  this.lineh2 = Math.floor(2*this.char_width);
  this.linehb2 = Math.floor(this.char_width/2);
  this.timelinew = Math.floor(this.vtimeline.width - 2*this.padx);

  // clear
  ctx.fillStyle = '#ffffff';
  ctx.clearRect(0, 0, this.vtimeline.width, this.vtimeline.height);
  ctx.fillRect(0, 0, this.vtimeline.width, this.vtimeline.height);

  // draw line
  ctx.strokeStyle = '#707070';
  ctx.fillStyle = '#707070';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(this.padx, 1);
  ctx.lineTo(this.padx + this.timelinew, 1);
  ctx.stroke();

  // draw time gratings and corresponding label
  var start = this.padx;
  var end = this.timelinew - this.padx;
  var time;
  ctx.beginPath();
  for ( ; start <= end; start = start + 10*this.char_width ) {
    ctx.moveTo(start, 1);
    ctx.lineTo(start, this.lineh - 1);

    time = this._vtimeline_canvas2time(start);
    ctx.fillText(this._vtimeline_time2str(time), start, this.lineh2 - 1);
  }
  ctx.stroke();

  //// timeline mark showing the current video time
  this.vtimeline_mark = document.createElement('canvas');
  this.vtimeline_mark.setAttribute('class', 'video_timeline_mark');
  this.vtimeline_mark_ctx = this.vtimeline_mark.getContext('2d', {alpha:false});
  this.vtimeline_mark.width = this.vtimeline.width;
  this.vtimeline_mark.height = this.lineh2;

  this.c.appendChild(this.vtimeline_mark);
  this.c.appendChild(this.vtimeline);

  this._vtimeline_mark_draw();
}

_via_time_annotator.prototype._vtimeline_mark_draw = function() {
  var time = this.m.currentTime;
  var cx = this._vtimeline_time2canvas(time);

  // clear
  this.vtimeline_mark_ctx.font = '16px Mono';
  this.vtimeline_mark_ctx.fillStyle = 'white';
  this.vtimeline_mark_ctx.fillRect(0, 0,
                                   this.vtimeline_mark.width,
                                   this.vtimeline_mark.height);

  // draw arrow
  this.vtimeline_mark_ctx.fillStyle = 'red';
  this.vtimeline_mark_ctx.beginPath();
  this.vtimeline_mark_ctx.moveTo(cx, this.lineh2);
  this.vtimeline_mark_ctx.lineTo(cx - this.linehb2, this.lineh);
  this.vtimeline_mark_ctx.lineTo(cx + this.linehb2, this.lineh);
  this.vtimeline_mark_ctx.moveTo(cx, this.lineh2);
  this.vtimeline_mark_ctx.fill();

  // draw current time
  this.vtimeline_mark_ctx.fillStyle = '#707070';
  this.vtimeline_mark_ctx.fillText(this._vtimeline_time2strms(time),
                                   cx + this.lineh, this.lineh2 - 2);

  window.requestAnimationFrame(this._vtimeline_mark_draw.bind(this))
}

_via_time_annotator.prototype._vtimeline_on_mousedown = function(e) {
  var canvas_x = e.offsetX;
  var time = this._vtimeline_canvas2time(canvas_x);
  this.m.currentTime = time;
}

_via_time_annotator.prototype._vtimeline_on_mousemove = function(e) {
  var time = this._vtimeline_canvas2time(e.offsetX);
  this._thumbnail_show(time, e.offsetX, e.offsetY);
}

_via_time_annotator.prototype._vtimeline_on_mouseout = function(e) {
  this._thumbnail_hide();
}

//
// Thumbnail
//
_via_time_annotator.prototype._thumbnail_show = function(time, x, y) {
  this.thumbnail_container.innerHTML = '';
  this.thumbnail_container.appendChild(this.thumbnail.get_thumbnail(time));
  this.thumbnail_container.style.display = 'inline-block';

  this.thumbnail_container.style.left = x + this.lineh2 + 'px';
  this.thumbnail_container.style.top  = y + this.lineh4 + 'px';
}

_via_time_annotator.prototype._thumbnail_hide = function(t) {
  this.thumbnail_container.style.display = 'none';
}

//
// Temporal Segmenter (tseg)
//
_via_time_annotator.prototype._tseg_init = function() {
  this.tseg_container = document.createElement('div');
  this.tseg_container.setAttribute('class', 'tseg_container');
  this.c.appendChild(this.tseg_container);

  this.tseg_container_width = this.tseg_container.clientWidth;
  this.tseg_container_height = Math.floor(this.char_width * 10);

  this.tseg_metadata_panel = document.createElement('div');
  this.tseg_metadata_panel.setAttribute('class', 'metadata_panel');
  this.tseg_metadata_panel.style.display = 'none';
  this.tseg_container.appendChild(this.tseg_metadata_panel);

  this.tseg = document.createElement('canvas');
  this.tseg.addEventListener('mousemove', this._tseg_on_mousemove.bind(this));
  this.tseg.addEventListener('mousedown', this._tseg_on_mousedown.bind(this));
  this.tseg.addEventListener('mouseup', this._tseg_on_mouseup.bind(this));

  var duration = this.m.duration;
  var width_per_sec = this.linehb2;
  this.tseg.width = this.tseg_container_width;
  this.tseg.height = this.tseg_container_height;
  this.tseg_timelinew = Math.floor(this.tseg.width - 2*this.padx);
  this.tseg_timelinewb2 = Math.floor(this.tseg_timelinew/2);
  this.tseg_mid = Math.floor(this.padx + this.tseg_timelinew/2);
  this.tseg_width_per_sec = Math.floor(6*this.char_width);
  this.tsegctx = this.tseg.getContext('2d', { alpha:false });
  this.lineh3 = Math.floor(this.char_width * 3);
  this.lineh4 = Math.floor(this.char_width * 4);
  this.lineh5 = Math.floor(this.char_width * 5);
  this.lineh6 = Math.floor(this.char_width * 6);
  this.lineh7 = Math.floor(this.char_width * 7);
  this.lineh8 = Math.floor(this.char_width * 8);
  this.lineh9 = Math.floor(this.char_width * 9);
  this.lineh10 = Math.floor(this.char_width * 10);
  this.tseg_container.appendChild(this.tseg);

  this._tseg_timeline_update_boundary();
  this._tseg_update();
}

_via_time_annotator.prototype._video_current_time_has_metadata = function() {
  var t = this.m.currentTime;
  var n = this.tseg_metadata_time_list.length;
  var i;
  for ( i = 0; i < n; ++i ) {
    if ( t >= this.tseg_metadata_time_list[i][0] &&
         t <= this.tseg_metadata_time_list[i][1] ) {
      return i;
    }
  }
  return -1;
}

_via_time_annotator.prototype._tseg_update = function() {
  // speed up video when inside metadata
  if ( this.current_playback_mode === this.PLAYBACK_MODE.NORMAL ) {
    this.m.playbackRate = 1;
  } else {
    var mindex = this._video_current_time_has_metadata();
    if ( mindex !== -1 ) {
      if ( this.current_playback_mode === this.PLAYBACK_MODE.REVIEW ) {
        this.m.playbackRate = 1;
      } else {
        this.m.playbackRate = 10;
      }
    } else {
      if ( this.current_playback_mode === this.PLAYBACK_MODE.REVIEW ) {
        this.m.playbackRate = 10;
      } else {
        this.m.playbackRate = 1;
      }
    }
  }

  this._tseg_clear();

  if ( this.m.currentTime < this.tseg_timeline_tstart ||
       this.m.currentTime > this.tseg_timeline_tend
     ) {
    this._tseg_timeline_update_boundary();
  }

  this._tseg_timeline_drawtick();
  this._tseg_timeline_drawtime();
  this._tseg_metadata_draw_container();
  this._tseg_metadata_draw_seg();
  this._tseg_marknow_draw();
  window.requestAnimationFrame(this._tseg_update.bind(this));
}

_via_time_annotator.prototype._tseg_timeline_update_boundary = function() {
  this.tseg_timeline_tstart = this.m.currentTime;
  var dt = this.tseg_timelinew / this.tseg_width_per_sec;
  this.tseg_timeline_tend = this.tseg_timeline_tstart + dt;

  this._tseg_timeline_update_metadata();
}

_via_time_annotator.prototype._tseg_timeline_update_metadata = function() {
  // gather all the metadata contained in this time range
  this.tseg_metadata_mid_list = [];
  this.tseg_metadata_time_list = [];
  this.tseg_metadata_label_list = [];
  var fid = this.file.fid;
  var mid, tn, t0, t1;
  for ( mid in this.d.metadata_store[fid] ) {
    tn = this.d.metadata_store[fid][mid].z.length;
    if ( tn ) {
      var i;
      for ( i = 0; i < tn; i = i+2 ) {
        t0 = this.d.metadata_store[fid][mid].z[i];
        t1 = this.d.metadata_store[fid][mid].z[i+1];
        if ( t0 >= this.tseg_timeline_tstart &&
             t1 <= this.tseg_timeline_tend
           ) {
          this.tseg_metadata_mid_list.push(mid);
          this.tseg_metadata_time_list.push([t0, t1]);
          this.tseg_metadata_label_list.push(this.d.metadata_store[fid][mid].metadata[0]);
        }
      }
    }
  }
}

_via_time_annotator.prototype._tseg_clear = function() {
  this.tsegctx.fillStyle = '#f2f2f2';
  this.tsegctx.clearRect(0, 0, this.tseg.width, this.tseg.height);
  this.tsegctx.fillRect(0, 0, this.tseg.width, this.tseg.height);
}

_via_time_annotator.prototype._tseg_marknow_draw = function() {
  var tnow = this.m.currentTime;
  var markx = this._tseg_timeline_time2canvas(tnow);

  // draw vertical line indicating current time
  this.tsegctx.strokeStyle = 'red';
  this.tsegctx.lineWidth = 1;
  this.tsegctx.beginPath();
  this.tsegctx.moveTo(markx, 1);
  this.tsegctx.lineTo(markx, this.tseg.height - 1);
  this.tsegctx.stroke();
}

_via_time_annotator.prototype._tseg_timeline_drawtick = function() {
  var tnow = this.m.currentTime;

  // draw line
  this.tsegctx.strokeStyle = '#707070';
  this.tsegctx.fillStyle = '#707070';
  this.tsegctx.lineWidth = 1;
  this.tsegctx.beginPath();
  this.tsegctx.moveTo(this.padx, this.lineh3);
  this.tsegctx.lineTo(this.padx + this.tseg_timelinew, this.lineh3);
  this.tsegctx.stroke();

  // draw ticks
  var start = this.padx;
  var end = start + this.tseg_timelinew;
  if ( this.tseg_timeline_tstart !== 0 ) {
    start = start + this.tseg_width_per_sec;
  }
  var t = this.tseg_timeline_tstart;
  this.tsegctx.strokeStyle = '#707070';
  this.tsegctx.beginPath();
  for ( ; start <= end; start = start + this.tseg_width_per_sec ) {
    this.tsegctx.moveTo(start, this.lineh2);
    this.tsegctx.lineTo(start, this.lineh3);
    t = t + 1;
    if ( t >= this.m.duration ) {
      break;
    }
  }
  this.tsegctx.stroke();
}

_via_time_annotator.prototype._tseg_timeline_drawtime = function() {
  this.tsegctx.fillStyle = '#707070';
  this.tsegctx.font = '10px Sans';
  var t = this.tseg_timeline_tstart;
  var start = this.padx;
  var end = start + this.tseg_timelinew - this.tseg_width_per_sec;
  for ( ; start <= end; start = start + this.tseg_width_per_sec ) {
    this.tsegctx.fillText(this._vtimeline_time2str(t), start, this.lineh2 );
    t = t + 1;
    if ( t > this.m.duration ) {
      break;
    }
  }
}

_via_time_annotator.prototype._tseg_metadata_draw_container = function() {
  // draw line
  this.tsegctx.strokeStyle = '#707070';
  this.tsegctx.fillStyle = '#707070';
  this.tsegctx.lineWidth = 1;
  this.tsegctx.beginPath();
  this.tsegctx.moveTo(this.padx, this.lineh5);
  this.tsegctx.lineTo(this.padx + this.tseg_timelinew, this.lineh5);
  this.tsegctx.lineTo(this.padx + this.tseg_timelinew, this.lineh7);
  this.tsegctx.lineTo(this.padx, this.lineh7);
  this.tsegctx.lineTo(this.padx, this.lineh5);
  this.tsegctx.stroke();
}

_via_time_annotator.prototype._tseg_metadata_draw_seg = function() {
  this.tsegctx.strokeStyle = '#707070';
  this.tsegctx.font = '12px Sans';
  this.tsegctx.lineWidth = 1;
  var n = this.tseg_metadata_time_list.length;
  var i;
  var color, left, right, label, mid;
  for ( i = 0; i < n; ++i ) {
    color = this.METADATA_COLOR_LIST[ i % this.METADATA_COLOR_LIST.length ];
    left  = this._tseg_timeline_time2canvas(this.tseg_metadata_time_list[i][0]);
    right = this._tseg_timeline_time2canvas(this.tseg_metadata_time_list[i][1]);
    label = this.tseg_metadata_mid_list[i]
    // fill metadata boundary
    this.tsegctx.beginPath();
    this.tsegctx.moveTo(left + 1, this.lineh5 + 1);
    this.tsegctx.lineTo(right - 1, this.lineh5 + 1);
    this.tsegctx.lineTo(right - 1, this.lineh7 - 1);
    this.tsegctx.lineTo(left + 1, this.lineh7 - 1);
    this.tsegctx.lineTo(left + 1, this.lineh5 + 1);

    if ( this.tseg_is_metadata_selected &&
         this.tseg_metadata_sel_mindex === i
       ) {
      this.tsegctx.strokeStyle = '#000000';
      this.tsegctx.stroke();
    } else {
      this.tsegctx.fillStyle = color;
      this.tsegctx.fill();
    }
    this.tsegctx.fillStyle = '#000000';
    this.tsegctx.fillText(this.tseg_metadata_label_list[i], left + 1, this.lineh5 - 2);
  }
}

_via_time_annotator.prototype._tseg_timeline_canvas2time = function(x) {
  var T = this.tseg_timeline_tend - this.tseg_timeline_tstart;
  var dx = x - this.padx;
  return this.tseg_timeline_tstart + ((T * dx) / this.tseg_timelinew);
}

_via_time_annotator.prototype._tseg_timeline_time2canvas = function(t) {
  if ( t < this.tseg_timeline_tstart || t > this.tseg_timeline_tend ) {
    return -1;
  }
  var dt = this.tseg_timeline_tend - this.tseg_timeline_tstart;
  return Math.floor(this.padx + (this.tseg_timelinew / dt) * (t - this.tseg_timeline_tstart));
}

_via_time_annotator.prototype._tseg_time_to_metadata_index = function(t) {
  var n = this.tseg_metadata_time_list.length;
  var i, dt0, dt1;
  for ( i = 0; i < n; ++i ) {
    dt0 = Math.abs(t - this.tseg_metadata_time_list[i][0]);
    dt1 = Math.abs(t - this.tseg_metadata_time_list[i][1]);
    if ( dt0 < 0.1 || dt1 < 0.1 ) {
      // on boundary
      if ( dt0 < 0.1 ) {
        return [i, 0]; // left boundary
      } else {
        return [i, 1]; // right boundary
      }
    } else {
      if ( t > this.tseg_metadata_time_list[i][0] &&
           t < this.tseg_metadata_time_list[i][1]
         ) {
        return [i, -1];
      }
    }
  }
  return [-1, -1];
}

_via_time_annotator.prototype._tseg_on_mousemove = function(e) {
  // timeline
  if ( e.offsetY <= this.lineh3 ) {
    this.tseg.style.cursor = 'pointer';
    //var time = this._vtimeline_canvas2time(e.offsetX);
    //this._thumbnail_show(time, e.offsetX, e.offsetY);
    return;
  }

  // metadata
  if ( e.offsetY >= this.lineh5 && e.offsetY <= this.lineh7) {
    var t = this._tseg_timeline_canvas2time(e.offsetX);
    var mindex = this._tseg_time_to_metadata_index(t);
    if ( mindex[0] !== -1 ) {
      if ( mindex[1] !== -1 ) {
        this.tseg.style.cursor = 'ew-resize';
      } else {
        this.tseg.style.cursor = 'pointer';
      }
    } else {
      this.tseg.style.cursor = 'cell';
    }
    return;
  }

  this.tseg.style.cursor = 'default';
}

_via_time_annotator.prototype._tseg_on_mousedown = function(e) {
  var t = this._tseg_timeline_canvas2time(e.offsetX);
  // timeline
  if ( e.offsetY <= this.lineh3 ) {
    this.m.currentTime = t;
    return;
  }

  // metadata
  if ( e.offsetY >= this.lineh5 && e.offsetY <= this.lineh7 ) {
    var mindex = this._tseg_time_to_metadata_index(t);
    // clicked on one of the visible metadata?
    if ( mindex[0] !== -1 ) {
      // clicked on boundary?
      if ( mindex[1] !== -1 ) {
        // resize
        this.tseg_is_metadata_resize_ongoing = true;
        this.tseg_metadata_sel_bindex = mindex[1];
        this.tseg_metadata_sel_mindex = mindex[0];
      } else {
        if ( this.tseg_is_metadata_selected ) {
          if ( this.tseg_metadata_sel_mindex === mindex[0] ) {
            // remove selection
            this._tseg_metadata_unselect();
          } else {
            // update selection
            this._tseg_metadata_select(mindex[0]);
          }
        } else {
          // select
          this._tseg_metadata_select(mindex[0]);
        }
      }
    } else {
      // @todo add new segment
    }
    return;
  }

  // clear state if clicked anywhere else
  this._tseg_metadata_unselect();
  this.tseg_is_metadata_resize_ongoing = false;
  this.tseg_metadata_sel_bindex = -1;
}

_via_time_annotator.prototype._tseg_on_mouseup = function(e) {
  var t = this._tseg_timeline_canvas2time(e.offsetX);

  if ( this.tseg_is_metadata_resize_ongoing ) {
    this.tseg_is_metadata_resize_ongoing = false;
    var mid = this.tseg_metadata_mid_list[this.tseg_metadata_sel_mindex];
    this._tseg_metadata_update_time(mid, this.tseg_metadata_sel_bindex, t);
    this._tseg_timeline_update_metadata();
  }
}

//
// Metadata Panel
//
_via_time_annotator.prototype._tseg_metadata_select = function(mindex) {
  this.tseg_is_metadata_selected = true;
  this.tseg_metadata_sel_mindex = mindex;

  var mid = this.tseg_metadata_mid_list[ this.tseg_metadata_sel_mindex ];
  var x = this._tseg_timeline_time2canvas( this.tseg_metadata_time_list[mindex][0] );
  var y = this._tseg_timeline_time2canvas( this.tseg_metadata_time_list[mindex][1] );
  this._tseg_metadata_panel_show(mid, x, y);
}

_via_time_annotator.prototype._tseg_metadata_unselect = function(mid) {
  this.tseg_is_metadata_selected = false;
  this.tseg_metadata_sel_mindex = -1;
  this._tseg_metadata_panel_hide();
}

_via_time_annotator.prototype._tseg_metadata_panel_show = function(mid, x, y) {
  this.tseg_metadata_panel.style.display = 'inline-block';
  this.tseg_metadata_panel.style.left = (x + 1) + 'px';
  this.tseg_metadata_panel.style.top = (this.lineh7 + 2) + 'px';

  this.tseg_metadata_panel.innerHTML = '';
  this.tseg_metadata_panel.appendChild( this._tseg_metadata_panel_init(mid) );
}

_via_time_annotator.prototype._tseg_metadata_panel_hide = function() {
  this.tseg_metadata_panel.style.display = 'none';
}

_via_time_annotator.prototype._tseg_metadata_panel_init = function(mid) {
  var table = document.createElement('table');
  var fid = this.file.fid;
  var thead = document.createElement('thead');
  var thead_tr = document.createElement('tr');

  var tbody = document.createElement('tbody');
  var tbody_tr = document.createElement('tr');

  var aid;
  for ( aid in this.d.attribute_store ) {
    var head_td = document.createElement('td');
    head_td.innerHTML = this.d.attribute_store[aid].attr_name;
    thead_tr.appendChild(head_td);

    var body_td = document.createElement('td');
    var el = this._tseg_metadata_html_element(fid, mid, aid);
    el.addEventListener('change', this._tseg_metadata_on_change.bind(this));
    body_td.appendChild(el);
    tbody_tr.appendChild(body_td);
  }

  thead.appendChild(thead_tr);
  tbody.appendChild(tbody_tr);
  table.appendChild(thead);
  table.appendChild(tbody);

  return table;
}

_via_time_annotator.prototype._tseg_metadata_html_element = function(fid, mid, aid) {
  var aval  = this.d.metadata_store[fid][mid].metadata[aid];
  var dval  = this.d.attribute_store[aid].default_option_id;
  var atype = this.d.attribute_store[aid].type;
  var el    = this.d.attribute_store[aid].html_element();
  el.setAttribute('data-fid', fid);
  el.setAttribute('data-mid', mid);
  el.setAttribute('data-aid', aid);

  switch(atype) {
  case _VIA_ATTRIBUTE_TYPE.TEXT:
    if ( typeof(aval) === 'undefined' ) {
      aval = dval;
    }
    el.innerHTML = aval;

    break;

  case _VIA_ATTRIBUTE_TYPE.SELECT:
    // set the selected option corresponding to atype
    var n = el.options.length;
    var i;
    if ( typeof(aval) === 'undefined' ) {
      aval = dval;
    }
    for ( i = 0; i < n; ++i ) {
      if ( el.options[i].value === aval ) {
        el.options[i].setAttribute('selected', 'true');
      } else {
        el.options[i].removeAttribute('selected');
      }
    }
    break;

  default:
    console.log('attribute type ' + atype + ' not implemented yet!');
    var el = document.createElement('span');
    el.innerHTML = aval;
    return el;
  }
  return el;
}

_via_time_annotator.prototype._tseg_metadata_on_change = function(e) {
  var value = e.target.value;
  var fid = e.target.dataset.fid;
  var mid = e.target.dataset.mid;
  var aid = e.target.dataset.aid;

  this.d.metadata_update_attribute_value(fid, mid, aid, value);
}

_via_time_annotator.prototype._tseg_metadata_update_time = function(mid, bindex, t) {
  this.d.metadata_store[this.file.fid][mid].z[bindex] = t;
}

_via_time_annotator.prototype._on_event_metadata_update = function(fid, mid) {
  this._tseg_timeline_update_metadata();
}