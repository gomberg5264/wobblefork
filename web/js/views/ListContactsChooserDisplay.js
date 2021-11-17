/*global ContactsChooserDisplay */
"use strict";

/**
 * A contactschooser dialog similar to the original Google Wave version.
 * The dialog shows all contacts who are not yet added to the topic in a list.
 * The user can filter the list with a textfield at the top. 
 * The left/right keys navigate inside the filter.
 * The up/down keys navigate in the contacts list.
 * By clicking a contact or pressing [Enter] when selected, the callback onAddContact() gets fired.
 */
function ListContactsChooserDisplay(relativeTo) {
  this.e = $('<div></div>').attr('id', 'contactschooser').appendTo('body'); // The element to use
  this.e.css('display', 'none');
  this.e.addClass('dialog');

  this.relativeTo = relativeTo;

  this.contacts = [];
  this.selectedContact = null;
}


ListContactsChooserDisplay.prototype = new ContactsChooserDisplay();
ListContactsChooserDisplay.prototype.constructor = ListContactsChooserDisplay;

ListContactsChooserDisplay.prototype.KEY_UP = 38;
ListContactsChooserDisplay.prototype.KEY_DOWN = 40;
ListContactsChooserDisplay.prototype.KEY_ENTER = 13;
ListContactsChooserDisplay.prototype.KEY_ESCAPE = 27;

ListContactsChooserDisplay.prototype.show = function(title) {
  this.title = title;
  this.render([]); // Render an empty list
};
ListContactsChooserDisplay.prototype.render = function(contacts) {
  this.contacts = contacts;
  var $filterText, $contactList;

  // Generate the content
  var template =  '<div id="contactschooser_title">{{title}}</div>' +
          '<div class="buttons"><button class=button_close>x</button></div>' +
          '<div id="contactschooser_filter"><input type=text id="contactschooser_filter_text"></div>' +
          '<ul id="contactschooser_list">' +
          '</ul>';
  this.e.empty().append(Mustache.render(template, {
    'title': this.title
  }));
  $contactList = $('#contactschooser_list', this.e);
  if (this.contacts.length === 0) {
    $contactList.append('<li>No contacts</li>');
  } else {
    _.each(this.contacts, function(contact, i) {
      var template =
        "<li class='contact' title='{{email}}' id='contactchooser-contact-{{contact_id}}'>" +
        " {{> user_avatar }}" +
        " <span class=\"name\">{{name}}</span>" +
        "</li>";

      var view = {
          contact_id: contact.id,
          email: contact.email,
          name: contact.name,

          // Avatar Partial
          avatar_size: 20,
          avatar_title: contact.name,
          avatar_url: contact.avatar_url || "http://gravatar.com/avatar/" + contact.img + "?=20",
          avatar_online: contact.online == 1 ? 'online' : 'offline'
      };
      var partials = {
        'user_avatar': MustacheAvatarPartial.template
      };

      var $li = $(Mustache.render(template, view, partials))
      $li.appendTo($contactList)
        .data('contact', contact);

      $li.click($.proxy(function() {
        // Move cursor to clicked and then one down
        this.setSelectedContact(contact);
        this.navigateNextContact();

        // Contact was clicked
        this.onAddContact(contact);
        $li.detach(); // Remove row after adding it
        $filterText.focus(); // Refocus the text input, where we capture the keyboard events
      }, this));

      if (i === 0) {
        // Autoselect the first element
        this.setSelectedContact(contact);
      }
    }, this);
  }

  // Install button-listeners
  $('.button_close', this.e).click($.proxy(function() {
    this.close();
  }, this));

  $filterText = $("#contactschooser_filter_text");
  $filterText.keydown($.proxy(function(e) {
    if (e.which == ListContactsChooserDisplay.prototype.KEY_ESCAPE) {
      // Close dialog on escape
      this.close();
    }
    else if (e.which == ListContactsChooserDisplay.prototype.KEY_UP) {
      // Naviagte up
      this.navigatePreviousContact();
      e.preventDefault();
    }
    else if (e.which == ListContactsChooserDisplay.prototype.KEY_DOWN) {
      // Navigate down
      this.navigateNextContact();
      e.preventDefault();
    }
    else if (e.which == ListContactsChooserDisplay.prototype.KEY_ENTER) {
      e.preventDefault();
      $('#contactchooser-contact-' + this.selectedContact.id).click(); // Simulate clicking on it
    }

  }, this));
  $filterText.keyup($.proxy(function(e) {
    // Refresh filtered list
    this.refreshFilteredContactList($filterText.val());
  }, this));

  // Position it relative to this.relativeTo
  if (this.relativeTo) {
    var relativeElem = $(this.relativeTo);
    var pos = relativeElem.offset();
    this.e.css('top', pos.top).css('left', pos.left - (this.e.width() * 0.75));
  }

  // Finally, show it
  this.e.css('display', '');

  // And focus the textfield
  $filterText.focus();
};
ListContactsChooserDisplay.prototype.close = function() {
  this.e.empty().css('display', 'none'); // Clear and hide
  this.onClose(); // Notify caller
};
ListContactsChooserDisplay.prototype.setSelectedContact = function(contact) {
  $('.active', this.e).removeClass('active');
  if (contact !== null) {
    $('#contactchooser-contact-' + contact.id, this.e).addClass('active');
  }

  this.selectedContact = contact;
};
ListContactsChooserDisplay.prototype.navigateNextContact = function() {
  var element = $("#contactchooser-contact-" + this.selectedContact.id);

  // Find the next element which is visible
  do {
    element = element.next();
  } while (element.css('display') == 'none');

  if (element && element.length > 0) {
    this.setSelectedContact(element.data('contact'));

    // Ensure that the element is visible
    var $list = $("#contactschooser_list", this.e);

    for (var i = 0; i < 100 && element.position().top > $list.height(); i++) {
      $list.scrollTop($list.scrollTop() + element.height());
    }
  }
};
ListContactsChooserDisplay.prototype.navigatePreviousContact = function() {
  var element = $("#contactchooser-contact-" + this.selectedContact.id);

  // Find the next element which is visible
  do {
    element = element.prev();
  } while (element.css('display') == 'none');

  if (element && element.length > 0) {
    this.setSelectedContact(element.data('contact'));

    // Ensure that the element is visible
    var $list = $("#contactschooser_list", this.e);

    for (var i = 0; i < 100 && element.position().top < 0; i++) {
      $list.scrollTop($list.scrollTop() - element.height());
    }
  }
};
ListContactsChooserDisplay.prototype.refreshFilteredContactList = function(filterText) {
  var firstContact = null;

  $(".contact", this.e).css('display', ''); // Show all contacts

  filterText = filterText.toLowerCase();

  for (var i = 0; i < this.contacts.length; i++) {
    var contact = this.contacts[i];
    // Show all elements
    if (!(contact.name.toLowerCase().indexOf(filterText) >= 0 || contact.email.indexOf(filterText) >= 0)) {
      // text not found in name or email
      var $contact = $("#contactchooser-contact-"+ contact.id);
      $contact.css('display', 'none');

      // If the selectedContact is now hidden, set selectedContact to null
      if (contact == this.selectedContact) {
        this.setSelectedContact(null);
      }
    } else {
      if (firstContact === null) {
        firstContact = contact;
      }
    }
  }

  if (this.selectedContact === null && firstContact !== null) {
    // No contact selected, mark the first visible one
    this.setSelectedContact(firstContact);
  }
};
