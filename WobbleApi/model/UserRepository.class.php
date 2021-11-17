<?php
/**
 *
 */
class UserRepository {
  public static function getUserCount() {
    $pdo = ctx_getpdo();
    $result = $pdo->query('SELECT COUNT(*) cnt FROM `users`')->fetchAll();
    return $result[0]['cnt'];
  }

  public static function create($name, $password_hashed, $email) {
    $pdo = ctx_getpdo();
    $stmt = $pdo->prepare('INSERT INTO users (name, password_hashed, email) VALUES (?,?,?)');
    $stmt->execute(array($name, $password_hashed, strtolower(trim($email))));

    $userid = intval($pdo->lastInsertId());
    return $userid;
  }

  public static function updateName($user_id, $name) {
    $pdo = ctx_getpdo();
    $stmt = $pdo->prepare('UPDATE users SET name = trim(?) WHERE id = ?');
    $stmt->execute(array($name, $user_id));
  }

  public static function updatePassword($user_id, $hashedPassword) {
    $pdo = ctx_getpdo();
    $stmt = $pdo->prepare('UPDATE users SET password_hashed = ? WHERE id = ?');
    $stmt->execute(array($hashedPassword, $user_id));    
  }

  /**
   * Returns the user with the given ID including the hashed password.
   */
  public static function get($user_id, $include_password_hash = false) {
    $pdo = ctx_getpdo();

    $stmt = $pdo->prepare('SELECT id, name, password_hashed, email,
          COALESCE((select max(last_touch) from sessions us where us.user_id = id) > (UNIX_TIMESTAMP() - 300), false) online
        FROM users 
        WHERE id = ?');
    $stmt->execute(array($user_id));

    $result = $stmt->fetchAll();
    if (count($result) == 1) {
      return UserRepository::fromResult($result[0], $include_password_hash);
    } else {
      return NULL;
    }
  }

  public static function getUserByEmail($email, $include_password_hash = false) {
    $pdo = ctx_getpdo();

    $stmt = $pdo->prepare('SELECT id, name, password_hashed, email,
          COALESCE((select max(last_touch) from sessions us where us.user_id = id) > (UNIX_TIMESTAMP() - 300), false) online
         FROM users 
        WHERE email = ?');
    $stmt->execute(array(strtolower(trim($email))));

    $result = $stmt->fetchAll();
    if (count($result) == 1) {
      return UserRepository::fromResult($result[0], $include_password_hash);
    } else {
      return NULL;
    }
  }

  public static function delete($user_id) {
    $pdo = ctx_getpdo();

    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute(array($user_id));
    $pdo->prepare('DELETE FROM notifications WHERE user_id = ?')->execute(array($user_id));
    $pdo->prepare('DELETE FROM user_archived_topics WHERE user_id = ?')->execute(array($user_id));
    $pdo->prepare('DELETE FROM users_contacts WHERE user_id = ?')->execute(array($user_id));
    $pdo->prepare('DELETE FROM users_contacts WHERE contact_user_id = ?')->execute(array($user_id));
    $pdo->prepare('DELETE FROM topic_readers WHERE user_id = ?')->execute(array($user_id));
    $pdo->prepare('DELETE FROM topic_messages WHERE user_id = ?')->execute(array($user_id));
    $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute(array($user_id));
    $pdo->prepare('DELETE FROM post_users_read WHERE user_id = ?')->execute(array($user_id));

    return true;
  }

  private static function fromResult($result, $include_password_hash = false) {
    $result['id'] = intval($result['id']);
    $result['online'] = intval($result['online']);
    $result['img'] = md5($result['email']);
    $result['avatar_url'] = 'http://gravatar.com/avatar/' . md5($result['email']);

    if (!$include_password_hash) {
      unset($result['password_hashed']);
    }
    return $result;
  }
}