/**
 * @class
 * @classdesc Editor for metadata and attributes
 * @author Abhishek Dutta <adutta@robots.ox.ac.uk>
 * @since 14 Jan. 2019
 */
function _via_editor(container, data, annotator) {
  this.c = container;
  this.d = data;
  this.a = annotator;

  if ( typeof(this.c.innerHTML) === 'undefined' ) {
    throw 'invalid html container or media element!';
  }

  this.init();

  // initialise event listeners
  this.a.on_event('file_show', this.on_event_file_show.bind(this));
  this.d.on_event('metadata_add', this.on_event_metadata_add.bind(this));
  this.d.on_event('metadata_del', this.on_event_metadata_del.bind(this));
  this.d.on_event('attribute_update', this.on_event_attribute_update.bind(this));
  this.d.on_event('attribute_del', this.on_event_attribute_del.bind(this));
  this.d.on_event('attribute_add', this.on_event_attribute_add.bind(this));
}

_via_editor.prototype.TYPE = { 'METADATA':2, 'ATTRIBUTE':3 };

_via_editor.prototype.init = function() {
  // top line: editor content selector {metadata, attribute}
  this.editor_content_selector = document.createElement('div');
  this.editor_content_selector.setAttribute('class', 'editor_content_selector');
  var title = document.createElement('span');
  title.innerHTML = 'Show: ';
  this.edit_metadata_checkbox = document.createElement('input');
  this.edit_metadata_checkbox.setAttribute('name', 'metadata');
  this.edit_metadata_checkbox.setAttribute('type', 'checkbox');
  this.edit_metadata_checkbox.addEventListener('change', this.on_editor_content_select.bind(this));
  var edit_metadata_label = document.createElement('label');
  edit_metadata_label.innerHTML = 'Metadata';
  edit_metadata_label.setAttribute('for', 'metadata');
  edit_metadata_label.setAttribute('title', 'Metadata corresponds to values assigned by user for the attributes.');

  this.edit_attribute_checkbox = document.createElement('input');
  this.edit_attribute_checkbox.setAttribute('name', 'attribute');
  this.edit_attribute_checkbox.setAttribute('type', 'checkbox');
  this.edit_attribute_checkbox.addEventListener('change', this.on_editor_content_select.bind(this));
  var edit_attribute_label = document.createElement('label');
  edit_attribute_label.innerHTML = 'Attribute';
  edit_attribute_label.setAttribute('for', 'attribute');
  edit_attribute_label.setAttribute('title', 'Attribute corresponds to fields like name, color, etc. required to describe the region of interest');

  this.editor_content_selector.appendChild(title);
  this.editor_content_selector.appendChild(this.edit_metadata_checkbox);
  this.editor_content_selector.appendChild(edit_metadata_label);
  this.editor_content_selector.appendChild(this.edit_attribute_checkbox);
  this.editor_content_selector.appendChild(edit_attribute_label);

  // metadata
  this.metadata_container = document.createElement('div');
  this.metadata_container.setAttribute('id', 'metadata_container');
  this.metadata_container.setAttribute('class', 'metadata_container');
  this.metadata_view = document.createElement('table');
  var metadata_title = document.createElement('h2');
  metadata_title.innerHTML = 'Metadata';
  this.metadata_container.appendChild( metadata_title );
  this.metadata_container.appendChild( this.metadata_view );

  // attribute
  this.attribute_container = document.createElement('div');
  this.attribute_container.setAttribute('id', 'attribute_container');
  this.attribute_container.setAttribute('class', 'attribute_container');
  this.attribute_view = document.createElement('table');
  var attribute_title = document.createElement('h2');
  attribute_title.innerHTML = 'Attributes';

  this.attribute_container.appendChild( attribute_title );
  this.attribute_container.appendChild( this.get_attribute_name_entry_panel() );
  this.attribute_container.appendChild( this.attribute_view );

  this.content_container = document.createElement('div');
  this.content_container.setAttribute('class', 'content_container');
  this.content_container.appendChild(this.metadata_container);
  this.content_container.appendChild(this.attribute_container);

  // add everything to container
  this.c.appendChild(this.editor_content_selector);
  this.c.appendChild(this.content_container);

  this.metadata_update();
  this.attributes_update();

  // initial state of content
  this.edit_metadata_checkbox.checked = true;
  this.metadata_container.classList.remove('hide');
  this.edit_attribute_checkbox.checked = false;
  this.attribute_container.classList.add('hide');
}

//
// Editor content selector
//
_via_editor.prototype.on_editor_content_select = function(selector) {
  var element;
  switch(selector.target.name) {
  case 'metadata':
    element = this.metadata_container;
    break;
  case 'attribute':
    element = this.attribute_container;
    break;
  }

  if ( selector.target.checked ) {
    element.classList.remove('hide');
  } else {
    element.classList.add('hide');
  }
}

//
// metadata
//
_via_editor.prototype.metadata_clear = function() {
  this.metadata_view.innerHTML = '';
}

_via_editor.prototype.metadata_update = function() {
  this.metadata_clear();

  if ( this.a.now.file ) {
    var fid = this.a.now.file.fid;
    if ( typeof(this.d.metadata_store[fid]) === 'undefined' ) {
      return;
    }

    var metadata_count = Object.keys(this.d.metadata_store[fid]).length;
    if ( metadata_count ) {
      // add header
      this.metadata_view.appendChild( this.get_metadata_header() );

      // add each metadata
      var tbody = document.createElement('tbody');
      var metadata_index = 1;
      var mid;
      for ( mid in this.d.metadata_store[fid] ) {
        tbody.appendChild( this.metadata_get(fid, mid, metadata_index) );
        metadata_index = metadata_index + 1;
      }
      this.metadata_view.appendChild(tbody);
    } else {
      this.metadata_view.innerHTML = '<tr><td>No metadata added yet!</td></tr>';
    }
  } else {
    this.metadata_view.innerHTML = '<tr><td><i>No metadata added yet!</i></td></tr>';
  }
}

_via_editor.prototype.metadata_get = function(fid, mid, metadata_index) {
  var tr = document.createElement('tr');
  tr.setAttribute('data-fid', fid);
  tr.setAttribute('data-mid', mid);

  // first column: the action tools for metadata (like delete)
  var action_tools_container = document.createElement('td');
  this.get_metadata_action_tools(action_tools_container, fid, mid);
  tr.appendChild( action_tools_container );

  // second column: index of this metadata
  var metadata_index_container = document.createElement('td');
  metadata_index_container.innerHTML = metadata_index;
  tr.appendChild(metadata_index_container);

  // third column: where (i.e. location of metadata)
  var location = document.createElement('td');
  var where_type = document.createElement('span');
  where_type.innerHTML = this.d.metadata_store[fid][mid].where_type_str();
  location.appendChild(where_type);
  if ( this.d.metadata_store[fid][mid].where_target() === _VIA_WHERE_TARGET.SEGMENT &&
       this.d.metadata_store[fid][mid].where_target() === _VIA_WHERE_SHAPE.TIME
     ) {
    var n = this.d.metadata_store[fid][mid].where.length;
    var i;
    var ul = document.createElement('ul');
    for ( i = 2; i < n; i = i + 2 ) { // the time coordinates are stored in array[2,...]
      var li = document.createElement('li');
      // only one segment
      var t1 = document.createElement('button');
      t1.setAttribute('class', 'text_button');
      t1.setAttribute('data-fid', fid);
      t1.setAttribute('data-mid', mid);
      t1.setAttribute('data-where_index', 2);
      t1.innerHTML = this.d.metadata_store[fid][mid].where[i].toFixed(3).toString();
      t1.addEventListener('click', this.jump_to_metadata.bind(this));

      var arrow = document.createElement('span');
      arrow.innerHTML = '&rarr;';

      var t2 = t1.cloneNode();
      t2.setAttribute('data-where_index', 3);
      t2.innerHTML = this.d.metadata_store[fid][mid].where[i+1].toFixed(3).toString();
      t2.addEventListener('click', this.jump_to_metadata.bind(this));

      li.appendChild(t1);
      li.appendChild(arrow);
      li.appendChild(t2);
      ul.appendChild(li);
    }
    location.appendChild(ul);
  }
  tr.appendChild(location);

  // subsequent columns: what (i.e. the attributes for this metadata)
  var aid;
  for ( aid in this.d.attribute_store ) {
    var td = document.createElement('td');
    td.setAttribute('data-aid', aid);
    td.appendChild( this.get_attribute_html_element(fid, mid, aid) );
    tr.appendChild(td);
  }

  return tr;
}

_via_editor.prototype.get_metadata_action_tools = function(container, fid, mid) {
  var del = _via_util_get_svg_button('micon_delete', 'Delete Metadata');
  del.setAttribute('data-fid', fid);
  del.setAttribute('data-mid', mid);
  del.addEventListener('click', this.metadata_del.bind(this));
  container.appendChild(del);

  /*
  var edit = _via_util_get_svg_button('micon_edit', 'Select Metadata for Editing');
  edit.setAttribute('data-fid', fid);
  edit.setAttribute('data-mid', mid);
  edit.addEventListener('click', this.metadata_edit.bind(this));
  container.appendChild(edit);
  */
}

_via_editor.prototype.get_attribute_html_element = function(fid, mid, aid) {
  var aval  = this.d.metadata_store[fid][mid].what[aid];
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

_via_editor.prototype.get_metadata_header = function() {
  var tr = document.createElement('tr');
  tr.appendChild( this.html_element('th', '') );
    tr.appendChild( this.html_element('th', 'Id') );
  tr.appendChild( this.html_element('th', 'Location') );

  var aid;
  for ( aid in this.d.attribute_store ) {
    tr.appendChild( this.html_element('th',
                                      this.d.attribute_store[aid].attr_name)
                  );
  }

  var thead = document.createElement('thead');
  thead.appendChild(tr);
  return thead;
}

_via_editor.prototype.html_element = function(name, text) {
  var e = document.createElement(name);
  e.innerHTML = text;
  return e;
}

//
// Metadata preview
//

_via_editor.prototype.jump_to_metadata = function(e) {
  var fid = e.target.dataset.fid;
  var mid = e.target.dataset.mid;
  var where_index = e.target.dataset.where_index;
  if ( this.d.metadata_store[fid][mid].where_target() === _VIA_WHERE_TARGET.SEGMENT &&
       this.d.metadata_store[fid][mid].where_target() === _VIA_WHERE_SHAPE.TIME
     ) {
    this.a.preload[fid].media_annotator.media.currentTime = this.d.metadata_store[fid][mid].where[where_index];
  }
}

//
// attribute
//
_via_editor.prototype.attribute_clear = function() {
  this.attribute_view.innerHTML = '';
}

_via_editor.prototype.attributes_update = function() {
  this.attribute_clear();

  if ( this.d.aid_list.length ) {
    this.attribute_view.appendChild( this.get_attribute_header() );

    // add each metadata
    var tbody = document.createElement('tbody');
    var aindex;
    for ( aindex in this.d.aid_list ) {
      var aid = this.d.aid_list[aindex];
      tbody.appendChild( this.get_attribute(aid) );
    }
    this.attribute_view.appendChild(tbody);
  }
}

_via_editor.prototype.get_attribute_header = function() {
  var tr = document.createElement('tr');
  tr.appendChild( this.html_element('th', '') );
  tr.appendChild( this.html_element('th', 'Id') );
  tr.appendChild( this.html_element('th', 'Name') );
  tr.appendChild( this.html_element('th', 'Type') );
  tr.appendChild( this.html_element('th', 'Default Value') );
  tr.appendChild( this.html_element('th', 'Options') );
  tr.appendChild( this.html_element('th', 'Preview') );

  var thead = document.createElement('thead');
  thead.appendChild(tr);
  return thead;
}

_via_editor.prototype.get_attribute = function(aid) {
  var tr = document.createElement('tr');
  tr.setAttribute('data-aid', aid);

  // first column: the action tools for metadata (like delete)
  var action_tools_container = document.createElement('td');
  this.get_attribute_action_tools(action_tools_container, aid);
  tr.appendChild( action_tools_container );

  // second column: aid (i.e. attribute id)
  tr.appendChild( this.html_element('td', aid) );

  // third column: name
  tr.appendChild( this.html_element('td', this.d.attribute_store[aid].attr_name) );

  // fourth column: type
  var type_select = document.createElement('select');
  type_select.setAttribute('data-aid', aid);
  type_select.addEventListener('change', this.attribute_update_type.bind(this));
  var type_str;
  for ( type_str in _VIA_ATTRIBUTE_TYPE ) {
    var oi = document.createElement('option');
    oi.setAttribute('value', _VIA_ATTRIBUTE_TYPE[type_str]);
    oi.innerHTML = type_str;

    if ( _VIA_ATTRIBUTE_TYPE[type_str] === this.d.attribute_store[aid].type ) {
      oi.setAttribute('selected', '');
    }
    type_select.appendChild(oi);
  }
  var type = document.createElement('td');
  type.appendChild( type_select );
  tr.appendChild( type );

  // fifth column: default value (only if other than TEXT)
  if ( this.d.attribute_store[aid].type === _VIA_ATTRIBUTE_TYPE.TEXT ) {
    // text has no defaults
    tr.appendChild( this.html_element('td', '-') );
  } else {
    var option = this.d.attribute_store[aid].options[ this.d.attribute_store[aid].default_option_id ];
    tr.appendChild( this.html_element('td', option) );
  }

  // sixth column: options
  if ( this.d.attribute_store[aid].type === _VIA_ATTRIBUTE_TYPE.TEXT ) {
    // text has no defaults
    tr.appendChild( this.html_element('td', '-') );
  } else {
    var option_input = document.createElement('textarea');
    option_input.setAttribute('data-aid', aid);
    option_input.setAttribute('title', 'Enter options as comma separated value with the default option prefixed using an *. For example: "a,*b,c"');
    option_input.addEventListener('change', this.attribute_update_options.bind(this));
    option_input.innerHTML = this.d.attribute_store[aid].options_to_csv();
    tr.appendChild( option_input );
  }

  // sixth column: preview of attribute
  var preview = document.createElement('td');
  preview.appendChild( this.d.attribute_store[aid].html_element() );
  tr.appendChild(preview);

  return tr;
}

_via_editor.prototype.get_attribute_name_entry_panel = function() {
  var c = document.createElement('div');
  c.setAttribute('class', 'attribute_entry');

  this.new_attribute_name_input = document.createElement('input');
  this.new_attribute_name_input.setAttribute('type', 'text');
  this.new_attribute_name_input.setAttribute('placeholder', 'name of new attribute');
  c.appendChild(this.new_attribute_name_input);

  var add = document.createElement('button');
  add.setAttribute('class', 'text-button');
  add.innerHTML = 'Create';
  add.addEventListener('click', this.on_attribute_create.bind(this));
  c.appendChild(add);

  return c;
}

_via_editor.prototype.get_attribute_action_tools = function(container, aid) {
  var del = _via_util_get_svg_button('micon_delete', 'Delete Attribute');
  del.setAttribute('data-aid', aid);
  del.addEventListener('click', this.attribute_del.bind(this));
  container.appendChild(del);
}

_via_editor.prototype.update_attribute_for = function(aid) {
  var tbody = this.attribute_view.getElementsByTagName('tbody')[0];
  var n = tbody.childNodes.length;
  var i;
  for ( i = 0; i < n; ++i ) {
    if ( tbody.childNodes[i].dataset.aid === aid ) {
      var new_attribute = this.get_attribute(aid);
      tbody.replaceChild( new_attribute, tbody.childNodes[i] );
      break;
    }
  }
}

//
// Listeners for data update events
//
_via_editor.prototype.metadata_del = function(e) {
  var fid = e.currentTarget.dataset.fid;
  var mid = e.currentTarget.dataset.mid;
  this.d.metadata_del(fid, mid).then( function(ok) {
    // we don't need to do anything when metadata delete is successful
  }.bind(this), function(err) {
    console.log(err)
  }.bind(this));
}

_via_editor.prototype.metadata_edit = function(e) {
  var fid = e.target.parentNode.dataset.fid;
  var mid = e.target.parentNode.dataset.mid;
  console.log('@todo: edit metadata: fid=' + fid + ', mid=' + mid);
}

_via_editor.prototype.on_attribute_create = function(e) {
  var new_attribute_name = this.new_attribute_name_input.value;
  this.d.attribute_add(new_attribute_name,
                       _VIA_ATTRIBUTE_TYPE.TEXT
                      ).then( function(ok) {
                        // attribute was added
                      }.bind(this), function(err) {
                        console.log(err);
                      }.bind(this));
}

_via_editor.prototype.attribute_del = function(e) {
  var aid = e.currentTarget.dataset.aid;
  this.d.attribute_del(aid).then( function(ok) {
    // we don't need to do anything when attribute delete is successful
  }.bind(this), function(err) {
    console.log(err)
  }.bind(this));
}

_via_editor.prototype.attribute_update_options = function(e) {
  var aid = e.target.dataset.aid;
  var new_options_csv = e.target.value;
  console.log(e.target.innerHTML)
  this.d.attribute_update_options(aid, new_options_csv);
  console.log('aid='+aid+', new_options_csv='+new_options_csv);
}

_via_editor.prototype.attribute_update_type = function(e) {
  var aid = e.target.dataset.aid;
  var new_type = e.target.options[ e.target.selectedIndex ].value;
  this.d.attribute_update_type(aid, new_type);
  console.log('aid='+aid+', new_type='+new_type);
}

_via_editor.prototype.on_event_attribute_update = function(data, event_payload) {
  this.update_attribute_for(event_payload.aid);
}

_via_editor.prototype.on_event_attribute_del = function(data, event_payload) {
  this.metadata_update();
  this.attributes_update();
}

_via_editor.prototype.on_event_attribute_add = function(data, event_payload) {
  this.metadata_update();
  this.attributes_update();
}

_via_editor.prototype.on_event_metadata_add = function(data, event_payload) {
  this.metadata_update();
}

_via_editor.prototype.on_event_metadata_del = function(data, event_payload) {
  this.metadata_update();
}

_via_editor.prototype.on_event_file_show = function(data, event_payload) {
  this.metadata_update();
}