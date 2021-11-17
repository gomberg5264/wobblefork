<?php

/**
 * Manages the Roster of a User.
 */
class ContactsRepository {
  public static function addUser($user_id, $contact_user_id) {
    $pdo = ctx_getpdo();

    $stmt = $pdo->prepare('INSERT INTO users_contacts (user_id, contact_user_id) VALUES (?, ?)');
    $stmt->execute(array($user_id, $contact_user_id));
  }
  public static function removeUser($user_id, $contact_user_id) {
    $pdo = ctx_getpdo();

    $stmt = $pdo->prepare('DELETE FROM users_contacts WHERE user_id = ? AND contact_user_id = ?');
    $stmt->execute(array($user_id, $contact_user_id));
  }

  public static function getContacts($user_id) {
    $pdo = ctx_getpdo();
    $stmt = $pdo->prepare('SELECT DISTINCT c.contact_user_id id FROM users_contacts c WHERE c.user_id = ?');
    $stmt->execute(array($user_id));

    $result = array();
    foreach($stmt->fetchAll() AS $id) {
      $user = UserRepository::get($id['id']);
      if ($user != null)
        $result[] = $user;
    }
    return $result;
  }
}
