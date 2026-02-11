(function () {
    if (!window.Lampa) return;

    const RD = {
        name: 'Real-Debrid Native',
        api: 'https://api.real-debrid.com/rest/1.0',
        client_id: 'X245A4XAIBGVM',
        token: Lampa.Storage.get('rd_token', null)
    };

    function log() {
        console.log('[RD]', ...arguments);
    }

    function api(url, options = {}) {
        options.headers = options.headers || {};
        if (RD.token) options.headers['Authorization'] = 'Bearer ' + RD.token;
        return fetch(RD.api + url, options).then(r => r.json());
    }

    function detectHDR(name) {
        name = name.toLowerCase();
        return {
            dv: /dolby.?vision|dovi|dv/.test(name),
            hdr10: /hdr10(?!\+)/.test(name),
            hdr10plus: /hdr10\+|hdr10plus/.test(name)
        };
    }

    function play(url, title, flags) {
        if (flags.dv) {
            url += (url.includes('?') ? '&' : '?') + 'dv=1';
        }

        Lampa.Player.play({
            title: title,
            url: url,
            timeline: true,
            player_params: {
                dv: flags.dv,
                hdr: flags.hdr10 || flags.hdr10plus,
                codec: flags.dv ? 'dovi' : 'auto'
            }
        });
    }

    async function auth() {
        Lampa.Loader.show('Real-Debrid auth');

        const code = await fetch(
            `${RD.api}/oauth/v2/device/code?client_id=${RD.client_id}&new_credentials=yes`
        ).then(r => r.json());

        Lampa.Modal.open({
            title: 'Real-Debrid',
            html: `
                <div style="padding:1em">
                    <div>Go to:</div>
                    <b>${code.verification_url}</b>
                    <div>Code:</div>
                    <h2>${code.user_code}</h2>
                </div>
            `
        });

        const poll = setInterval(async () => {
            const cred = await fetch(
                `${RD.api}/oauth/v2/device/credentials?client_id=${RD.client_id}&code=${code.device_code}`
            ).then(r => r.json());

            if (cred.client_secret) {
                clearInterval(poll);

                const token = await fetch(
                    `${RD.api}/oauth/v2/token`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body:
                            `client_id=${cred.client_id}` +
                            `&client_secret=${cred.client_secret}` +
                            `&grant_type=http://oauth.net/grant_type/device/1.0`
                    }
                ).then(r => r.json());

                RD.token = token.access_token;
                Lampa.Storage.set('rd_token', RD.token);
                Lampa.Modal.close();
                Lampa.Loader.hide();
                Lampa.Noty.show('Real-Debrid connected');
            }
        }, code.interval * 1000);
    }

    async function streamMagnet(magnet) {
        Lampa.Loader.show('Sending magnet');

        const add = await api('/torrents/addMagnet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'magnet=' + encodeURIComponent(magnet)
        });

        let info;
        do {
            info = await api('/torrents/info/' + add.id);
            await new Promise(r => setTimeout(r, 3000));
        } while (!info.files || !info.links || !info.links.length);

        let bestFile = info.files.find(f => /dv|dolby.?vision/i.test(f.path))
            || info.files.find(f => /hdr/i.test(f.path))
            || info.files[0];

        await api('/torrents/selectFiles/' + add.id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'files=' + bestFile.id
        });

        const unlocked = await api('/unrestrict/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'link=' + encodeURIComponent(info.links[0])
        });

        Lampa.Loader.hide();

        const flags = detectHDR(unlocked.filename);
        play(unlocked.download, unlocked.filename, flags);
    }

    function openMagnetInput() {
        Lampa.Modal.open({
            title: 'Magnet',
            html: `<input id="rd_magnet" style="width:100%" placeholder="Paste magnet here">`,
            buttons: [
                {
                    name: 'Play',
                    onSelect: () => {
                        const magnet = document.getElementById('rd_magnet').value;
                        Lampa.Modal.close();
                        streamMagnet(magnet);
                    }
                }
            ]
        });
    }

    function view() {
        const html = $('<div class="rd-view"></div>');

        const authBtn = $('<div class="card">Authorize Real-Debrid</div>');
        const playBtn = $('<div class="card">Play Magnet</div>');

        authBtn.on('hover:enter', auth);
        playBtn.on('hover:enter', openMagnetInput);

        html.append(authBtn, playBtn);

        Lampa.Controller.add('rd_controller', {
            toggle: () => html.toggleClass('active'),
            back: () => Lampa.Activity.back()
        });

        Lampa.Controller.enable('rd_controller');
        return html;
    }

    Lampa.Plugin.create({
        name: RD.name,
        onLoad: function () {
            Lampa.Activity.push({
                url: 'rd',
                title: 'Real-Debrid',
                component: 'rd',
                type: 'category',
                onCreate: function () {
                    this.activity.render().find('.content').append(view());
                }
            });
        }
    });

})();
