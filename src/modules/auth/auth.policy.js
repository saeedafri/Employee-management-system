// Authorization policies for auth module
// Currently not used in Page 01, but here for future expansion

export function canManageUser(user, targetUserId) {
  // Super Admin can manage anyone
  if (user.memberType === 'SUPER_ADMIN') {
    return true;
  }

  // User can manage themselves
  return user.sub === targetUserId;
}
