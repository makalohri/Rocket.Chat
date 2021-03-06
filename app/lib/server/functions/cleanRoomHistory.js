import { TAPi18n } from 'meteor/tap:i18n';
import { FileUpload } from '/app/file-upload';
import { Messages, Rooms } from '/app/models';
import { Notifications } from '/app/notifications';
import { deleteRoom } from './deleteRoom';

export const cleanRoomHistory = function({ rid, latest = new Date(), oldest = new Date('0001-01-01T00:00:00Z'), inclusive = true, limit = 0, excludePinned = true, ignoreThreads = true, filesOnly = false, fromUsers = [] }) {
	const gt = inclusive ? '$gte' : '$gt';
	const lt = inclusive ? '$lte' : '$lt';

	const ts = { [gt]: oldest, [lt]: latest };

	const text = `_${ TAPi18n.__('File_removed_by_prune') }_`;

	let fileCount = 0;
	Messages.findFilesByRoomIdPinnedTimestampAndUsers(
		rid,
		excludePinned,
		ignoreThreads,
		ts,
		fromUsers,
		{ fields: { 'file._id': 1, pinned: 1 }, limit }
	).forEach((document) => {
		FileUpload.getStore('Uploads').deleteById(document.file._id);
		fileCount++;
		if (filesOnly) {
			Messages.update({ _id: document._id }, { $unset: { file: 1 }, $set: { attachments: [{ color: '#FD745E', text }] } });
		}
	});
	if (filesOnly) {
		return fileCount;
	}

	if (!ignoreThreads) {
		Messages.findThreadByRoomIdPinnedTimestampAndUsers(rid, excludePinned, ts, fromUsers, { fields: { trid: 1 }, ...(limit && { limit }) }).fetch()
			.forEach(({ trid }) => deleteRoom(trid));
	}

	const count = Messages.removeByIdPinnedTimestampLimitAndUsers(rid, excludePinned, ignoreThreads, ts, limit, fromUsers);
	if (count) {
		Rooms.resetLastMessageById(rid);
		Notifications.notifyRoom(rid, 'deleteMessageBulk', {
			rid,
			excludePinned,
			ignoreThreads,
			ts,
			users: fromUsers,
		});
	}
	return count;
};
