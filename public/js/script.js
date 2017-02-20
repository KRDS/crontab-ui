/*jshint esversion: 6 */
/*********** MessageBox ****************/

// simply show info.  Only close button
function infoMessageBox(message, title){
	$('#info-body').html(message);
	$('#info-title').html(title);
	$('#info-popup').modal('show');
}

// like info, but for errors.
function errorMessageBox(message) {
	$('#info-body').html(message);
	$('#info-title').html('Error');
	$('#info-popup').modal('show');
}

// modal with full control
function messageBox(body, title, okText, closeText, callback) {
	$('#modal-body').html(body);
	$('#modal-title').html(title);
	if (okText) $('#modal-button').html(okText);
	if (closeText) $('#modal-close-button').html(closeText);
	$('#modal-button').unbind('click');
	$('#modal-button').click(callback);
	$('#popup').modal('show');
}

function handleError(response) {
	var msg = response.statusText;
	if (response.status < 500
		&& response.responseJSON
		&& response.responseJSON.message) {
		msg = response.responseJSON.message;
	}
	msg =
		'Operation failed: ' + msg + '. ' +
		'Please see error log for details.';
	errorMessageBox(msg, 'Error');
}

function setFlash() {
	Cookies.set('flash', 'Crontab updated');
}

function showFlash() {
	var msg = Cookies.get('flash');
	Cookies.remove('flash');
	if (msg) {
		showAlert(msg);
	}
}

function showAlert(msg) {
	var alert = $('#alert-info');
	var content = $('#alert-info .content');
	var button = $('#alert-info .close');

	var timer = setTimeout(function() {
		alert.hide();
	}, 3000);

	button.unbind('click');
	button.click(function() {
		clearTimeout(timer);
		alert.hide();
	});

	content.text(msg);
	alert.show();
}

// TODO: by now we could build the entire table using JS, no need to pre-render.

// Calculate next execution from now and the full UTC date as a popover into
// the view.
function showCronDates() {
	var cron, m, elem;
	for (var i = 0; i < crontab.lines.length; i++) {
		job = crontab.lines[i];
		elem = $('#next-' + job.id);
		if (job.type !== 'cronjob') {
			continue;
		}
		if (job.next !== 'reboot') {
			m = moment(job.next);
			elem.text(m.fromNow());
			elem.attr('title', m.format());
		} else {
			elem.text('Reboot');
			elem.attr('title', 'After next reboot');
		}
	}
}

// Strip the logging/error email parts from the cron command for display. The
// full command will be set as `data-content` attribute for the popover.
function showCronCommands() {
	var cron, cmd, elem;
	for (var i = 0; i < crontab.lines.length; i++) {
		job = crontab.lines[i];
		if (job.type !== 'cronjob') {
			continue;
		}
		elem = $('#cmd-' + job.id);
		cmd = job.command;
		elem.text(cmd);
		elem.attr('data-content', '<code>' + job.command + '</code>');
	}
}

/*********** crontab actions ****************/

function deleteJob(id) {
	messageBox(
		'Do you want to delete this Job?',
		'Confirm delete',
		'Do It!',
		'Never Mind',
		function() {
			doDeleteJob(id);
		});
}

function doDeleteJob(id) {
	var cron = findJob(id);

	if(!cron) {
		errorMessageBox('Invalid job id: ' + id);
		return;
	}

	crontab.lines.splice(crontab.lines.indexOf(cron), 1);
	updateCrontab();
}

function findJob(id) {
	for(i = 0; i< crontab.lines.length; i++) {
		if (crontab.lines[i].id === id) {
			return crontab.lines[i];
		}
	}
}

function reloadCrontab() {
	location.reload();
}

function editJob(id){
	var cron = findJob(id);

	if(!cron) {
		errorMessageBox('Invalid job id: ' + id);
		return;
	}

	// if macro not used
	if(cron.schedule.indexOf('@') != 0){
		var components = cron.schedule.split(' ');
		$('#job-minute').val(components[0]);
		$('#job-hour').val(components[1]);
		$('#job-day').val(components[2]);
		$('#job-month').val(components[3]);
		$('#job-week').val(components[4]);
	}

	schedule = cron.schedule;
	jobCommand = cron.command;

	jobString();

	$('#job-command').val(jobCommand);

	$('#job-save').unbind('click');
	$('#job-save').click(function() {
		cron.command = decorate(jobCommand);
		cron.schedule = schedule;
		updateCrontab();
	});

	$('#job').modal('show');
}

function newJob(){
	schedule = '';
	jobCommand = '';

	$('#job-minute').val('*');
	$('#job-hour').val('*');
	$('#job-day').val('*');
	$('#job-month').val('*');
	$('#job-week').val('*');

	$('#job-name').val('');
	$('#job-command').val('');

	jobString();

	$('#job-save').unbind('click'); // remove existing events attached to this
	$('#job-save').click(function() {
		var cron = {
			command: decorate(jobCommand),
			schedule: schedule
		};
		crontab.lines.push(cron);
		updateCrontab();
	});

	$('#job').modal('show');
}

function updateCrontab() {
	var postData = crontab;

	$.ajax({
		type: 'post',
		url: '/save_crontab',
		data: JSON.stringify(postData),
		contentType: 'application/json',
		dataType: 'json',
	})
	.done(function() {
		setFlash('Crontab updated');
		reloadCrontab();
	})
	.fail(function(response) {
		if (response.status === 409) {
			handleConflictingUpdate();
		} else {
			handleError(response);
		}
	});
}

function handleConflictingUpdate() {
	var msg =
		'Looks like the crontab was updated by someone else. ' +
		'Please reload  the page and try again!'
	messageBox(
		msg,
		'Conflicting Update',
		'Reload Page',
		'Dismiss',
		function() {
			reloadCrontab();
		}
	);
}

function decorate(cmd) {
	// if (!email) return cmd;
	if (cmd === '') return cmd;
	if (/^cronic/.test(cmd)) return cmd;
	return 'cronic '+cmd;
}

// script corresponding to job popup management
var schedule = '';
var jobCommand = '';

function jobString(){
	$('#job-string').val(schedule + ' ' + decorate(jobCommand));
	return schedule + ' ' + decorate(jobCommand);
}

function setSchedule(){
	// console.log('set schedule');
	schedule =
		$("#job-minute").val() + " " +
		$("#job-hour").val() + " " +
		$("#job-day").val() + " " +
		$("#job-month").val() + " " +
		$("#job-week").val();
	jobString();
}
