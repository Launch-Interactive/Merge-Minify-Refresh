document.addEventListener('DOMContentLoaded', () =>
{
	'use strict';

	const POLL_INTERVAL = 2000;

	const mmrProcessed = document.getElementById('mmr_processed');
	if(!mmrProcessed) return;

	const mmrNoProcessed = document.getElementById('mmr_noprocessed');
	const mmrAdvanced = document.getElementById('mmr_advanced');
	const mmrAdvancedToggle = document.getElementById('mmr_advanced_toggle');
	const mmrJsProcessed = mmrProcessed.querySelector('#mmr_jsprocessed');
	const mmrCssProcessed = mmrProcessed.querySelector('#mmr_cssprocessed');
	const mmrJsProcessedUl = mmrJsProcessed?.querySelector('ul');
	const mmrCssProcessedUl = mmrCssProcessed?.querySelector('ul');

	let timeout = null;
	let stamp = null;

	// --- DOM helpers ---------------------------------------------------------

	const isHidden = (el) => getComputedStyle(el).display === 'none';

	const setVisible = (el, visible) =>
	{
		if(!el) return;
		el.style.display = visible ? '' : 'none';
		// If a stylesheet hides it by default, force it visible
		if(visible && isHidden(el))
		{
			el.style.display = 'block';
		}
	};

	const toggle = (el) => el && setVisible(el, isHidden(el));

	// Only touch the DOM when the content has actually changed
	const update = (el, html) =>
	{
		if(el && el.textContent !== html)
		{
			el.innerHTML = html;
		}
	};

	// --- Rendering -----------------------------------------------------------

	const itemTemplate = ({ hash, filename, accessed, log, error }) => `
		<li class="${hash}">
			<span class="filename${error ? ' error' : ''}">${filename}</span>
			<span class="accessed">Last Accessed: ${accessed}</span>
			<span class="actions">
				<a href="#" class="log button button-primary">View Log</a>
				<a href="#${hash}" class="button button-secondary purge">Purge</a>
			</span>
			<pre>${log}</pre>
		</li>`;

	const renderList = (items, ul) =>
	{
		if(!ul) return;

		for(const item of items)
		{
			const li = ul.querySelector(`li.${CSS.escape(item.hash)}`);

			if(!li)
			{
				ul.insertAdjacentHTML('beforeend', itemTemplate(item));
				continue;
			}

			const filename = li.querySelector('.filename');
			update(filename, item.filename);
			update(li.querySelector('pre'), item.log);
			update(li.querySelector('.accessed'), `Last Accessed: ${item.accessed}`);
			filename?.classList.toggle('error', !!item.error);
		}
	};

	const render = ({ js = [], css = [] }) =>
	{
		const hasFiles = js.length > 0 || css.length > 0;

		setVisible(mmrJsProcessed, js.length > 0);
		setVisible(mmrCssProcessed, css.length > 0);
		setVisible(mmrProcessed, hasFiles);
		setVisible(mmrNoProcessed, !hasFiles);

		renderList(js, mmrJsProcessedUl);
		renderList(css, mmrCssProcessedUl);
	};

	// --- Polling -------------------------------------------------------------

	const schedule = () =>
	{
		clearTimeout(timeout);
		timeout = setTimeout(() => getFiles(), POLL_INTERVAL);
	};

	const getFiles = async (extra = {}) =>
	{
		stamp = Date.now();
		const requestStamp = stamp;

		try
		{
			const res = await fetch(ajaxurl,
			{
				method: 'POST',
				body: new URLSearchParams({
					action: 'mmr_files',
					stamp: requestStamp,
					nonce: mmr.nonce,
					...extra
				})
			});

			if(!res.ok) throw new Error(`HTTP ${res.status}`);

			const response = await res.json();

			// Ignore responses from requests that have since been superseded
			if(requestStamp !== stamp) return;

			render(response);
		}
		catch(err)
		{
			console.error('mmr_files request failed:', err);
		}
		finally
		{
			// Only the latest request schedules the next poll
			if(requestStamp === stamp) schedule();
		}
	};

	const purge = (target) =>
	{
		clearTimeout(timeout);
		getFiles({ purge: target });
	};

	// --- Events --------------------------------------------------------------

	mmrProcessed.addEventListener('click', (e) =>
	{
		const button = e.target.closest('.log, .purge, .purgeall');
		if(!button) return;

		e.preventDefault();

		if(button.matches('.log'))
		{
			toggle(button.closest('li')?.querySelector('pre'));
		}
		else if(button.matches('.purge'))
		{
			purge(button.getAttribute('href').slice(1));
			button.closest('li')?.remove();
		}
		else
		{
			purge('all');
			setVisible(mmrNoProcessed, true);
			setVisible(mmrProcessed, false);
			if(mmrJsProcessedUl) mmrJsProcessedUl.innerHTML = '';
			if(mmrCssProcessedUl) mmrCssProcessedUl.innerHTML = '';
		}
	});

	mmrAdvancedToggle?.addEventListener('click', (e) =>
	{
		e.preventDefault();
		toggle(mmrAdvanced);
	});

	getFiles();
});
