/*global BUS  API TopicDisplay */
"use strict";

// UI Functions

var ROOT_ID = '1';

function JQueryTopicReadersPartial(parent, click_handler) {
  this.e = $('<div>').attr('id', 'topic_readers').addClass('header').appendTo(parent);
  this.readerList = $('<div>').addClass('readers').appendTo(this.e);
  this.moreBox = $('<div>').addClass('more_box').appendTo(this.e);
  this.showAllReaders = false;
  this.onUserClicked = click_handler;

  var that = this;
  this.moreBox.on('click', function() {
    that.showAllReaders = !that.showAllReaders;
    that.checkReaderOverflow();
  });
}
JQueryTopicReadersPartial.prototype.empty = function() {
  this.readerList.empty();
  this.moreBox.empty();
};
JQueryTopicReadersPartial.prototype.render = function(data) {
  this.readerList.empty();
  for(var i = 0; i < data.length; i++) {
    this.renderReader(data[i]);
  }
  this.checkReaderOverflow();
};
JQueryTopicReadersPartial.prototype.renderReader = function(user) {
  var containerId = "topic-reader-" + user.id;
  var container = $('#' + containerId);
  if (container.length === 0) {
    container = $("<span></span>").addClass('reader').attr('id', containerId).appendTo(this.readerList);
  } else {
    container.css('display', '');
  }

  container.html(MustacheAvatarPartial.renderMagic(user, 40))
    .off('click').click(function() {
      this.onUserClicked(user);
    }.bind(this));
};
JQueryTopicReadersPartial.prototype.checkReaderOverflow = function() {
  var hiddenUsers = 0;
  this.moreBox.css('display', ''); // Show this initially, so we can take its width into account

  if (this.showAllReaders) {
    $('.reader', this.readerList).css('display', '');
  } else {
    // Try to make the list smaller by hiding the last reader
    var readers = $('.reader', this.readerList);
    for (var trie = 1; this.e.outerHeight() > 56 && trie < 1000; trie++) {
      $(readers[readers.length - trie]).css('display', 'none');
      hiddenUsers++;
    }
  }

  if (this.showAllReaders && hiddenUsers === 0) {
    this.moreBox.text('Hide');
  }
  else if (hiddenUsers > 0) {
    this.moreBox.text(hiddenUsers + ' more');
  } else {
    this.moreBox.css('display', 'none');
  }
};



function JQueryTopicView() {  // The UI handler for the single topic
  var that = this;

  this.userCache = {}; // id => {id, name, email, img}
  this.editingPostId = null;
  this.currentTopic = null;
  this.readersExtended = false;

  this.e = $('<div></div>').addClass('widget').attr('id', 'topic_wrapper').appendTo('#widgets');

  this.readerView = new JQueryTopicReadersPartial(this.e, function (user) {that.onUserClicked(user);});
  this.$actions = $('<div></div>').attr('id', 'topic_actions').appendTo(this.e);
  this.$messages = $('<div></div>').attr('id', 'topic_messages').appendTo(this.e);
  this.$posts = $('<div></div>').attr('id', 'topic_posts').appendTo(this.e);

  $('body').on('keydown', this.globalKeyHandler = function (e) {
    // We ignore events that may come from an input element
    if (e.target.localName != 'body') {
      return;
    }
    var handled = false;
    var $post;
    // 37 left, 38 up, 39 right, 40 down
    // 13 enter
    // 69 'e'
    if (e.altKey === false && e.shiftKey === false && e.ctrlKey === false && e.keyCode >= 37 && e.keyCode <= 40) {
      $post = $('.active', that.$posts);

      if ($post.size() === 0 && e.keyCode === 40) {
        $("#post-1>.post").click();
      }
      else if ($post.size() > 0) {
        var $post_wrapper = $post.parent();
        var $new_post_wrapper;
        var $new_post;

        if (e.keyCode === 40 /* Down */) {
          $new_post_wrapper = $('>.post', $post_wrapper.nextAll('.post_wrapper')).parent().first();

          if ($new_post_wrapper.size() === 0) { // No down element. Maybe there is another reply_thread?
            $new_post_wrapper = $post_wrapper.parents('.intended_reply_thread').next('.intended_reply_thread:has(.post_wrapper)').children().filter('.post_wrapper:has(.post)').first();
          }
          if ($new_post_wrapper.size() === 0) {// No down element. Maybe we have a parent which has a next?
            $new_post_wrapper = $post_wrapper.parents('.post_wrapper').next('.post_wrapper:has(.post)');
          }
        }
        else if (e.keyCode === 38 /* Up */) {
          // Check, if there is a previous post in the current reply_thread
          $new_post_wrapper = $('>.post', $post_wrapper.prevAll('.post_wrapper')).parent().last();
          if ($new_post_wrapper.size() === 0) { // Maybe there is another thread?
            $new_post_wrapper = $post_wrapper.parents('.intended_reply_thread').prev('.intended_reply_thread:has(.post_wrapper)').children().filter('.post_wrapper:has(.post)').first();
          }
          if ($new_post_wrapper.size() === 0) { // Maybe we have a parent?
            $new_post_wrapper = $post_wrapper.parents('.post_wrapper:has(.post)').first();
          }
        }
        else if (e.keyCode === 37 /* Left */) {
          $new_post_wrapper = $('>.post', $post_wrapper.parents('.post_wrapper')).parents().first();
        }
        else if (e.keyCode === 39 /* Right */) {
          $new_post_wrapper = $('.post_wrapper:has(>.post)', $post_wrapper).first();
        }

        if ($new_post_wrapper && $new_post_wrapper.size() > 0) {
          $new_post = $('>.post', $new_post_wrapper);
          $new_post.click();
          $new_post[0].scrollIntoView(false);
          handled = true;
        }
      }
    }
    else if (e.keyCode === 69 /* E */) {
      $post = $('.active', that.$posts);
      if ($post.size() > 0) {
        var post = $post.parent().data('post');
        if (post) {
          that.openEditor(post);
          handled = true;
        }
      }
    } else if (e.keyCode === 13 /* Enter */ && e.altKey === false && e.shiftKey === false && e.ctrlKey === false) {
      $post = $('.active', that.$posts);
      if ($post.size() > 0) {
        that.createReply($post);
        handled = true;
      }
    }

    if (handled) {
      e.stopPropagation();
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  });

  this._renderTopicActions(false);

  // On a window.resize event wait for the transformations to finish (should be done in 300ms) and recalc height
  BUS.on('window.resize', function() {
    var t = this;
    window.setTimeout(function() {
      t.onResize();
    }, 350);
  }, this);
}
JQueryTopicView.prototype = new TopicDisplay();
JQueryTopicView.prototype.constructor = JQueryTopicView;

// Methods --------------------------------------------------------
JQueryTopicView.prototype.isEditing = function() {
    return this.editingPostId !== null;
};
JQueryTopicView.prototype.destroy = function destroy() {
  $('body').off('keydown', this.globalKeyHandler);
  this.e.remove();
  this.e = null;
};
JQueryTopicView.prototype.onResize = function() {
  var viewHeight = this.e.innerHeight();
  var offsetX = this.readerView.e.outerHeight() +
                this.$actions.outerHeight() +
                this.$messages.outerHeight();

  this.$posts.css('height', viewHeight - offsetX);
};
JQueryTopicView.prototype.clear = function() {
  this.editingPostId = null;
  this.currentTopic = null;
  this.readerView.showAllReaders = false;
  this.$posts.empty();
  this.readerView.empty();
  this.$actions.empty();
};

JQueryTopicView.prototype.setEnabled = function(enabled) {
  if (enabled) {
    $("button", this.$actions).removeAttr('disabled');
  } else {
    $("button", this.$actions).attr('disabled', 'disabled');
  }
};

JQueryTopicView.prototype.setLoadingState = function() {
  this.clear();
  this.setEnabled(false);
  this.$posts.append("<div class=loading>Loading ...</div>");
};

JQueryTopicView.prototype.renderTopic = function(topicDetails) {
  var i, user;

  $("#topic_posts .loading").detach();

  this.currentTopic = topicDetails;

  this._renderTopicActions($(".editing").length > 0);

  if (topicDetails) {
    this.setEnabled(true);

    this.readerView.empty();
    // Only cache the writers
    for (i = 0; i < topicDetails.writers.length; ++i) {
      user = topicDetails.writers[i];
      this.userCache[user.id] = user;
    }
    // Cache & render the readers
    for (i = 0; i < topicDetails.readers.length; ++i) {
      user = topicDetails.readers[i];
      this.userCache[user.id] = user; // Cache user object (user later to show the user post images)
    }
    this.readerView.render(topicDetails.readers);

    this.renderMessages(topicDetails.id, topicDetails.messages);

    this.onResize();

    this.renderPosts(topicDetails);
  } else {
    this.setEnabled(false);
  }
};

JQueryTopicView.prototype.renderMessages = function(topic_id, messages) {
  this.$messages.empty();
  _.each(messages, function(msgObj) {
    var that = this;
    var msg = msgObj.message;
    var message_id = msgObj.message_id;
    var str;

    if (msg.type === 'user_added') {
      str = msg.user_name + ' was added.';
    } else if (msg.type === 'user_removed') {
      str = msg.user_name + ' was removed';
    } else {
      console.log('Unknown message type: ' + msg.type);
    }

    if (str) {
      var con = $('<div></div>');
      con.addClass('message');
      $('<div></div>').html(str).appendTo(con);
      $('<button></button').text('x').click(function() {
        that.onMessageDismissed(message_id);
        con.remove();
        con = null;
      }).appendTo(con);
      con.appendTo(this.$messages);
    }
  }, this);
};

JQueryTopicView.prototype.renderPosts = function(topicDetails) {
  var $scrollToPost = null;
  for (var i = 0; i < topicDetails.posts.length; i++) {
    var $post = this.renderPost(topicDetails, topicDetails.posts[i]);
    if (!$scrollToPost && topicDetails.posts[i].deleted === 0 && topicDetails.posts[i].unread === 1) {
      $scrollToPost = $post; 
    }
  }
  this.renderAddReply();

  if ($scrollToPost && this.editingPostId === null) {
    $(">.post", $scrollToPost)[0].scrollIntoView(false);
  }
};

JQueryTopicView.prototype.renderPost = function(topic, post) {
  var elementPostId = 'post-' + post.id;
  var that = this;

  var jPostWrapper = $("#" + elementPostId);
  if (jPostWrapper.length === 0) {
    // Post does not exist yet in the UI => Create it
    jPostWrapper = $(
      "<div class='post_wrapper'>" +
      " <div class='post'>" +
      "   <div class='users'></div>" +
      "       <div class='time'></div>" +
      "   <div class='content'></div>" +
      "   <div class='buttons'></div>" +
      " </div>" +
      " <div class='post_replies empty'></div>" +
      "</div>").attr('id', elementPostId);

    if (post.parent) {
      var parentPostId = '#post-' + post.parent;
      if ($(parentPostId).size() === 0) {
        console.warn('no post with id ' + post.parent + ' found.');
      }
      if (post.intended_post === 1) {
        var parentPost = $(parentPostId + ">.post_replies");
        var thread = $('<div></div>').addClass('intended_reply_thread').appendTo(parentPost).append(jPostWrapper);
        if (parentPost.hasClass('empty')) {
          parentPost.removeClass('empty');
        } else {
          thread.addClass('thread_spacer');
        }
      } else {
        jPostWrapper.insertAfter(parentPostId);
      }
    } else { // Root post
      jPostWrapper.appendTo(this.$posts);
    }

  }
  jPostWrapper.data('post', post); // Refresh the bound post

  $(">.post", jPostWrapper).off('click').click(function() {
    var activePosts = $('#topic_wrapper .active');
    if (activePosts.size() > 0) {
      if (post.id === activePosts.first().parent().data('post').id) {
        return;
      }
      if (that.isEditing()) {
        that.closeEditor();
      }
      $("#topic_wrapper .active").removeClass('active');
    }
    // Add the nice green border to any clicked post
    $(this).addClass('active');

    that.onPostFocused(post);
  });

  if (post.deleted != 1) {
    // Render children

    var ePostUsers = $(">.post>.users", jPostWrapper);
    this._renderPostUsers(post, ePostUsers);

    var ePostContent = $(">.post>.content", jPostWrapper);
    if (post.id !== this.editingPostId) { // Leave the content untouched, if the user is editing it
      ePostContent.html(post.content);
      // Security: Change all link in the post to open in a new browser window
      $("a", ePostContent).attr('target', '_new');
    }
    if (post.unread === 1) {
      $("<div></div>").addClass('unread').appendTo($(">.post", jPostWrapper));
    } else {
      $('>.post>.unread', jPostWrapper).detach();
    }

    var ePostTime = $(">.post>.time", jPostWrapper).empty();
    ePostTime.text(this._renderTime(post.timestamp));

    var ePostButtons = $(">.post>.buttons", jPostWrapper).empty();
    this._addDefaultButtons(ePostButtons, post);
  } else {
    $(">.post",jPostWrapper).detach();
  }
  return jPostWrapper;
};

JQueryTopicView.prototype._renderTime = function(timestamp) {
  if (!timestamp) {
    return "";
  }
  // NOTE: This format the date in the german way (localized): dd.mm.yyyy hh24:mi
  var createdAt = new Date(timestamp * 1000), now = new Date();
  var hours = createdAt.getHours();
  if (hours < 10) {
    hours = "0" + hours;
  }
  var minutes = createdAt.getMinutes();
  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  var time = hours + ":" + minutes;

  var month = createdAt.getMonth() + 1;
  if (month < 0){
    month = "0" + month;
  }

  if (createdAt.getYear() === now.getYear() &&
     createdAt.getMonth() === now.getMonth() &&
     createdAt.getDate() === now.getDate()) { // This post is from today, only show the time
    return time;
  } else {
    return createdAt.getDate() + "." + month + "."+ (1900 + createdAt.getYear()) + " " + time;
  }
};

JQueryTopicView.prototype._renderPostUsers = function(post, postElement) {
  var that = this;
  var apiUserId = API.user_id();

  if (postElement === null) {
    postElement = $("#post-" + post.id + ">.post>.users");
  }
  postElement.empty();

  var minHeight = 16;
  if (post.id !== ROOT_ID) { // No user icons for the root
    var size = post.users.length === 1 ? 25 : 21;
    for (var i = 0; i < post.users.length; i++) {
      var postUserId = post.users[i];
      postElement.append(MustacheAvatarPartial.renderMagic(this.userCache[postUserId], size));
    }
    minHeight = size;
  }

  // Part 2: Render the author names
  function name(index) {
    if (that.userCache[post.users[index]].id === apiUserId) {
      return "Me";
    } else {
      return that.userCache[post.users[index]].name;
    }
  }


  var authorLine = null;
  if (post.users.length === 1 && (post.id !== ROOT_ID || post.users[0] !== apiUserId) /* no authorline for ourself */) {
    authorLine = name(0);
  } else if (post.users.length === 2) {
    authorLine = name(0) + " and " + name(1);
  } else if (post.users.length === 3) {
    authorLine = name(0) + ", " + name(1) + " and " + name(2);
  } else if (post.users.length >= 4) {
    authorLine = name(0) + ", " + name(1) + " and " + (post.users.length-2) + " more";
  } else {
    // NO authorlines (also no icons) => No min height
    minHeight = null;
  }
  postElement.append($("<span class='names'></span>").text(authorLine));
  if (minHeight) postElement.css('min-height', minHeight);

};

JQueryTopicView.prototype.renderAddReply = function() {
  if ($("#add_reply").size() > 0) {
    return;
  }
  var $addReply = $('<div id="add_reply">Click here to add a reply</div>');
  var that = this;
  $addReply.click(function() {
    var rootPosts = $('>.post_wrapper', that.$posts);
    if (rootPosts.size() > 0) {
      var lastPost = rootPosts.eq(-1);
      that.onReplyPost(lastPost.data('post'));
    }
  });
  $addReply.appendTo(that.$posts);
};

JQueryTopicView.prototype.removePost = function(post) {
  var jpost = $('#post-' + post.id + ">.post");
  var parent = jpost.parent(); // postwrapper
  var container = parent.parent(); // #topic_posts or .intended_reply_thread
  jpost.detach();
  if ($('>.post_replies', parent).hasClass('empty')) {
    parent.detach();
  }
  if (container.hasClass('intended_reply_thread') && container.children().size() === 0) {
    container.detach();
  }
};

JQueryTopicView.prototype.openEditor = function(post) {
  this.closeEditor(); // Close any open editor there is

  var that = this;

  this.editingPostId = post.id;
  this.onStartPostEdit(post); // Fire notifier event

  var jpost = $("#post-" + post.id + ">.post");
  jpost.click();

  var eContent = $(">.content", jpost).attr('contenteditable', 'true');
  eContent.addClass('editing').focus();
  eContent.keydown(function(event) {
    if (event.shiftKey && event.which == 13) {
      // Focus the button, otherwise there is a rendering bug in chrome when removing the
      // contenteditable from the div while it has focus (the editing border does not get removed, until you click somewhere)
      $(">.buttons>button", jpost).first().focus();
      that.closeEditor();

      event.stopPropagation();
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
  this._addDefaultButtons($(">.buttons", jpost).empty(), post);

  this._renderTopicActions(true);
};

JQueryTopicView.prototype.closeEditor = function() {
  var $editing = $(".editing");
  var $post = $editing.parents('.post');
  var $postWrapper = $post.parents('.post_wrapper');
  var post = $postWrapper.data('post');

  if ($editing.length > 0) {
    this._renderTopicActions(false);
    $editing.attr('contenteditable', 'false').removeClass('editing');
    this.editingPostId = null;

    this._addDefaultButtons($(".buttons", $post).empty(), post);

    var newContent = $editing.html();
    this.onStopPostEdit(post, newContent);
  }
};

JQueryTopicView.prototype._addDefaultButtons = function(jbuttons, post) {
  var that = this;

  if (this.editingPostId == post.id) {
    $("<button><b>Done</b> <span style='font-size:small; color:gray'>[Shift+Enter]</span></button>").appendTo(jbuttons).click(function(event) {
      that.closeEditor();

      event.stopPropagation();
      event.preventDefault();
      event.stopImmediatePropagation();

    });
  } else {
    jbuttons.append($("<button>").addClass('lockable').text('Edit').attr('title', 'Click E').click(function(event) {
      that.openEditor(post);
    }));
    jbuttons.append($("<button>Reply</button>").click(function(event) {
      event.stopPropagation();
      event.preventDefault();
      event.stopImmediatePropagation();
      that.createReply($(this));
    }));
    if (post.id !== ROOT_ID) { // You cannot delete the root
      $("<button>Delete</button>").addClass('lockable').appendTo(jbuttons).click(function() {
        if (window.confirm('Are you sure to delete this post?')) {
          that.onDeletePost(post);
        }
      });
    }
  }

  if (post.locked) {
    $(".lockable", jbuttons).attr('disabled', 'disabled');
  }
  return jbuttons;
};

JQueryTopicView.prototype.createReply = function createReply($e) {
  var $post_wrapper = $e.closest('.post_wrapper');
  var post = $post_wrapper.data('post');
  if ($post_wrapper.size() === 0 || !post) {
    return;
  }

  // If the post-wrapper has a next-sibling, we create an intended-reply
  if ($post_wrapper.next('.post_wrapper').size() > 0) {
    this.onIntendedReplyPost(post);
  } else {
    this.onReplyPost(post);
  }
};

JQueryTopicView.prototype._renderTopicActions = function(editing) {
  this.$actions.empty();

  if (editing) {
    // See http://www.quirksmode.org/dom/execCommand/
    // for an example of commands
    $('<button title="Clear most formattings. Tip: Use BG with empty value to clear background color." class="icon rightborder">Clear</button>').appendTo(this.$actions).click(function() {
      document.execCommand('RemoveFormat', false, null);
    });

    $('<button title="Bold" class="icon boldicon rightborder"></button>').appendTo(this.$actions).click(function() {
      document.execCommand('bold', false, null);
    });
    $('<button title="Italic" class="icon italicicon"></button>').appendTo(this.$actions).click(function() {
      document.execCommand('italic', false, null);
    });
    $('<button title="Underline" class="icon underlineicon"></button>').appendTo(this.$actions).click(function() {
      document.execCommand('underline', false, null);
    });
    $('<button title="Strike" class="icon strikeicon borderright"></button>').appendTo(this.$actions).click(function() {
      document.execCommand('strikethrough', false, null);
    });

    $('<button title="Set background color" class="icon">BG</button>').appendTo(this.$actions).click(function() {
      var color = window.prompt('Color? (#FF0000 or red)');
      if (color !== null)
        document.execCommand('backcolor', true, color ||'white');
    });
    $('<button title="Set foreground color" class="icon">FG</button>').appendTo(this.$actions).click(function() {
      var color = window.prompt('Color? (#FF0000 or red)');
      if (color !== null)
        document.execCommand('forecolor', false, color ||'black');
    });
    $('<button title="Indent text" class="icon">&gt;&gt;</button>').appendTo(this.$actions).click(function() {
      document.execCommand('indent', false);
    });
    $('<button title="Outdent text" class="icon">&lt;&lt;</button>').appendTo(this.$actions).click(function() {
      document.execCommand('outdent', false);
    });
    /* Not supported by IE8
    $('<button class="icon borderright">Hi</button>').appendTo(this.$actions).click(function() {
      var color = window.prompt('Color? (#FF0000 or red)');
      if (color!=null)
        document.execCommand('hilitecolor', false, color || 'black');
    });
    */

    $('<button title="Make numbered list" class="icon olisticon"></button>').appendTo(this.$actions).click(function() {
      document.execCommand('insertorderedlist', false, null);
    });
    $('<button title="Make list" class="icon listicon borderright"></button>').appendTo(this.$actions).click(function() {
      document.execCommand('insertunorderedlist', false, null);
    });
    $('<button title="Insert image from url" class="icon imgicon">img</button>').appendTo(this.$actions).click(function() {
      var url = window.prompt("URL?");
      if (url !== null) {
        document.execCommand('insertimage', false, url);
      }
    });
    $('<button title="Make link" class="icon urlicon"></button>').appendTo(this.$actions).click(function() {
      var url = window.prompt("URL?");
      if (url !== null) {
        document.execCommand('createLink', false, url);
      }
    });

    $('<button title="Remove link from text" class="icon"><s>URL</s></button>').appendTo(this.$actions).click(function() {
      document.execCommand('Unlink');
    });
  } else {
    var that = this;
    $('<button title="Invite your contacts to this topic!" id="topic_invite_user">Invite user</button>').appendTo(this.$actions).click(function() {
      that.onInviteUserAction();
    });

    if (that.currentTopic) {
      if (that.currentTopic.archived === 1) {
        var bMoveToInbox = $('<button title="Move this topic back to your inbox." id="topic_move_to_inbox">Inbox</button>').appendTo(this.$actions).click(function() {
          that.onMoveToInbox();
        });
      }

      if (that.currentTopic.archived === 0) {
        var bMoveToArchive = $('<button title="Move this topic into the archive." id="topic_move_to_archive">Archive topic</button>').appendTo(this.$actions).click(function() {
          that.onMoveToArchive();
        });
      }
    }

    $('<button>').text('Read all').attr('title', 'Mark all posts as read').appendTo(this.$actions).on('click', that.onReadAll);
    $('<button>').text('Unread all').attr('title', 'Marks all posts as unread').appendTo(this.$actions).on('click', that.onUnreadAll);
  }
};
