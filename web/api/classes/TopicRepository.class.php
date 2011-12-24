<?php
/**
 * The TopicRepository provides convienience function to access the storage for Topics.
 */
class TopicRepository {
	function addReader($topic_id, $user_id) {
		$pdo = ctx_getpdo();

		$pdo->prepare('REPLACE topic_readers (topic_id, user_id) VALUES (?,?)')->execute(array($topic_id, $user_id));
	}

	function removeReader($topic_id, $user_id) {
		$pdo = ctx_getpdo();
		$pdo->prepare('DELETE FROM topic_readers WHERE topic_id = ? AND user_id = ?')->execute(array($topic_id, $user_id));

		$pdo->prepare('DELETE FROM post_users_read WHERE topic_id = ? AND user_id = ?')->execute(array($topic_id, $user_id));
	}
	function setPostReadStatus($user_id, $topic_id, $post_id, $read_status) {
		$pdo = ctx_getpdo();
		#var_dump($read_status);
		if ( $read_status == 1) { # if read, create entry
			$sql = 'REPLACE post_users_read (topic_id, post_id, user_id) VALUES (?,?,?)';
		} else {
			$sql = 'DELETE FROM post_users_read WHERE topic_id = ? AND post_id = ? AND user_id = ?';
		}
		$pdo->prepare($sql)->execute(array($topic_id, $post_id, $user_id));
	}

	# Traverses upwards and deletes all posts, if no child exist
	function deletePostsIfNoChilds($topic_id, $post_id) {
		if($post_id === '1') {
			return;
		}

		$pdo = ctx_getpdo();
		
		$sql = 'SELECT parent_post_id FROM posts WHERE topic_id = ? AND post_id = ? LIMIT 1';
		$stmt = $pdo->prepare($sql);
		$stmt->execute(array($topic_id, $post_id));
		$post = $stmt->fetchAll();
		var_dump($post);

		$sql = 'SELECT COUNT(*) child_count FROM posts WHERE topic_id = ? AND parent_post_id = ?'	;
		$stmt = $pdo->prepare($sql);
		$stmt->execute(array($topic_id, $post_id));
		$result = $stmt->fetchAll();
		var_dump($result);

		if ( intval($result[0]['child_count']) === 0 ) {
			# Delete the post
			$sql = 'DELETE FROM posts WHERE topic_id = ? AND post_id = ?';
			$stmt = $pdo->prepare($sql);
			$stmt->execute(array($topic_id, $post_id));

			# Check if we can delete its parent
			TopicRepository::deletePostsIfNoChilds($topic_id, $post[0]['parent_post_id']);

		}
	}

	/**
	 * Returns the user objects for every reader of a topic. Readers are the user which are allowed 
	 * to read and write to a topic.
	 */
	function getReaders($topic_id, $limit = FALSE) {
		assert('!empty($topic_id)');
		$pdo = ctx_getpdo();
		
		$sql = 'SELECT u.id id, u.name name, u.email email, md5(u.email) img, COALESCE(last_touch > (UNIX_TIMESTAMP() - 300), false) online ' . 
			  'FROM users u, topic_readers r ' . 
			  'WHERE u.id = r.user_id AND r.topic_id = ?';
		if ( $limit ) {
			$sql .= ' LIMIT ' . $limit;
		}
		$stmt = $pdo->prepare($sql);
		$stmt->execute(array($topic_id));
		return $stmt->fetchAll();
	}
}