/** *********
  VUE
***********/

// The following line loads the standalone build of Vue instead of the runtime-only build,
// so you don't have to do: import Vue from 'vue/dist/vue'
// This is done with the browser options. For the config, see package.json
import Vue from 'vue';

import localstore from 'store';
import _ from 'underscore';
Object.defineProperty(Vue.prototype, '$_', { value: _ });

import alertify from 'alertify.js';
Vue.prototype.$alertify = alertify;

import locale_strings from './locale_strings.js';

Vue.config.silent = false;
Vue.config.devtools = true;

Vue.prototype.$eventHub = new Vue(); // Global event bus

import PortalVue from 'portal-vue';
Vue.use(PortalVue);

import VueI18n from 'vue-i18n';
Vue.use(VueI18n);

let lang_settings = {
  available: {
    fr: 'Français',
    en: 'English'
  },
  default: 'en',
  current: '',
  init: function() {
    let localstore_lang = localstore.get('language');

    // // force lang to french
    // this.current = 'fr';
    // return;

    // has lang set
    if (localstore_lang !== undefined) {
      // exists in available
      if (this.available[localstore_lang] !== undefined) {
        this.current = localstore_lang;
      }
    }

    if (this.current === '') {
      // set current lang from window.navigator.language
      // window.navigator.language can be 'fr', 'en', or 'fr-FR'

      let browserLangIsAvailable = Object.keys(this.available).filter(x => {
        return window.navigator.language.includes(x);
      });
      if (browserLangIsAvailable.length > 0) {
        this.current = browserLangIsAvailable[0];
      }
    }

    if (this.current === '') {
      this.current = this.default;
    }
  }
};
lang_settings.init();

import moment from 'moment';
import 'moment/locale/fr';
import 'moment/locale/en-gb';

moment.locale(lang_settings.current);
Vue.prototype.$moment = moment;

const html = document.documentElement; // returns the html tag
html.setAttribute('lang', lang_settings.current);

// Create VueI18n instance with options
let i18n = new VueI18n({
  locale: lang_settings.current, // set locale
  messages: locale_strings // set locale messages
});

/** *********
  SOCKETIO
***********/
import io from 'socket.io-client';

Vue.prototype.$socketio = new Vue({
  i18n,
  data: {
    socket: ''
  },
  methods: {
    connect() {
      if (window.navigator.userAgent.indexOf('Chrome') > -1) {
        this.socket = io.connect({ transports: ['websocket', 'polling'] });
      } else {
        this.socket = io.connect({ transports: ['polling', 'websocket'] });
      }
      this.socket.on('connect', this._onSocketConnect);
      this.socket.on('reconnect', this._onReconnect);
      this.socket.on('error', this._onSocketError);
      this.socket.on('connect_error', this._onConnectError);
      this.socket.on('authentificated', this._authentificated);
      this.socket.on('listMedia', this._onListMedia);
      this.socket.on('listMedias', this._onListMedias);
      // used in publications
      this.socket.on('listFolder', this._onListFolder);
      this.socket.on('listFolders', this._onListFolders);

      this.socket.on('listSpecificMedias', this._onListSpecificMedias);
      this.socket.on('publiPDFGenerated', this._onPubliPDFGenerated);
      this.socket.on('publiVideoGenerated', this._onPubliVideoGenerated);

      this.socket.on('newNetworkInfos', this._onNewNetworkInfos);

      this.socket.on('notify', this._onNotify);
    },
    _onSocketConnect() {
      let sessionId = this.socket.io.engine.id;
      console.log(`Connected as ${sessionId}`);

      window.state.connected = true;

      // only for non-electron (since obviously in electron we have to be connected)
      if (!window.state.is_electron) {
        // this.$alertify
        //   .closeLogOnClick(true)
        //   .delay(4000)
        //   .success(this.$t('notifications.connection_active'));
      }

      this.listFolders({ type: 'layers' });
      // this.sendAuth();
    },

    _onReconnect() {
      this.$eventHub.$emit('socketio.reconnect');
      console.log(`Reconnected`);
    },

    sendAuth() {
      if (!this.socket) return;
      let admin_access = auth.getAdminAccess();
      console.log(
        `Asking for auth with ${JSON.stringify(admin_access, null, 4)}`
      );
      this.socket.emit('authenticate', { admin_access });
    },

    _onSocketError(reason) {
      console.log(`Unable to connect to server: ${reason}`);
      window.state.connected = false;
      // this.$alertify
      //   .closeLogOnClick(true)
      //   .error(this.$t('notifications.connection_error') + ' ' + reason);
    },

    _onConnectError(reason) {
      console.log(`Lost connection to server: ${reason}`);
      window.state.connected = false;
      // this.$alertify
      //   .closeLogOnClick(true)
      //   .error(
      //     this.$t('notifications.connection_lost') +
      //       '<br>' +
      //       this.$t('notifications.contents_wont_be_editable')
      //   );
    },

    // _authentificated(list_admin_folders) {
    //   console.log(
    //     `Admin for projects ${JSON.stringify(list_admin_folders, null, 4)}`
    //   );

    //   // compare local store and answer from server
    //   // for each key that is not in the answer, let’s send and alert to notify that the password is most likely wrong or the folder name has changed
    //   if (auth.getAdminAccess() !== undefined) {
    //     let admin_access = Object.keys(auth.getAdminAccess());
    //     admin_access.forEach(slugFolderName => {
    //       if (
    //         list_admin_folders === undefined ||
    //         list_admin_folders.indexOf(slugFolderName) === -1
    //       ) {
    //         this.$alertify
    //           .closeLogOnClick(true)
    //           .delay(4000)
    //           .error(
    //             this.$t('notifications["wrong_password_for_folder:"]') +
    //               ' ' +
    //               slugFolderName
    //           );
    //         auth.removeKey(slugFolderName);
    //       } else {
    //       }
    //     });
    //   }

    //   window.dispatchEvent(
    //     new CustomEvent('socketio.connected_and_authentified')
    //   );
    //   this.listFolders();
    // },

    _onListMedia(data) {
      console.log('Received _onListMedia packet.');

      let type = Object.keys(data)[0];
      let content = Object.values(data)[0];

      console.log(`Type is ${type}`);

      for (let slugFolderName in content) {
        console.log(`Media data is for ${slugFolderName}.`);
        if (window.store[type].hasOwnProperty(slugFolderName)) {
          window.store[type][slugFolderName].medias = Object.assign(
            {},
            window.store[type][slugFolderName].medias,
            content[slugFolderName].medias
          );

          // check if mdata has a mediaID (which would mean a user just created it)
          const mdata = Object.values(content[slugFolderName].medias)[0];
          if (mdata.hasOwnProperty('id')) {
            this.$eventHub.$emit('socketio.media_created_or_updated', mdata);
          }
        }
      }

      this.$eventHub.$emit(`socketio.${type}.listMedia`);
    },

    _onListMedias(data) {
      console.log('Received _onListMedias packet.');

      let type = Object.keys(data)[0];
      let content = Object.values(data)[0];

      console.log(`Type is ${type}`);

      for (let slugFolderName in content) {
        console.log(`Media data is for ${slugFolderName}.`);
        if (window.store[type].hasOwnProperty(slugFolderName)) {
          window.store[type][slugFolderName].medias =
            content[slugFolderName].medias;

          // if (type === 'projects') {
          //   window.state.list_of_projects_whose_medias_are_tracked.push(
          //     slugFolderName
          //   );
          // }
        }
      }
      this.$eventHub.$emit(`socketio.${type}.listMedias`);
    },

    _onListSpecificMedias(data) {
      console.log('Received _onListSpecificMedias packet.');

      let type = Object.keys(data)[0];
      let content = Object.values(data)[0];

      console.log(`Type is ${type}`);

      for (let slugFolderName in content) {
        console.log(`Media data is for ${slugFolderName}.`);
        if (
          window.store[type].hasOwnProperty(slugFolderName) &&
          window.store[type][slugFolderName].hasOwnProperty('medias')
        ) {
          window.store[type][slugFolderName].medias = Object.assign(
            {},
            window.store[type][slugFolderName].medias,
            content[slugFolderName].medias
          );
        }
      }
      this.$eventHub.$emit(`socketio.${type}.listSpecificMedias`);
    },

    _onPubliPDFGenerated(data) {
      console.log('Received _onPubliPDFGenerated packet.');
      this.$eventHub.$emit('socketio.publication.pdfIsGenerated', data);
    },

    _onPubliVideoGenerated(data) {
      console.log('Received _onPubliVideoGenerated packet.');
      this.$eventHub.$emit('socketio.publication.videoIsGenerated', data);
    },

    // for projects, authors and publications
    _onListFolder(data) {
      console.log('Received _onListFolder packet.');
      let type = Object.keys(data)[0];
      let content = Object.values(data)[0];

      // to prevent override of fully formed medias in folders, we copy back the ones we have already
      for (let slugFolderName in content) {
        if (
          window.store[type].hasOwnProperty(slugFolderName) &&
          window.store[type][slugFolderName].hasOwnProperty('medias')
        ) {
          content[slugFolderName].medias =
            window.store[type][slugFolderName].medias;
        }
        if (content[slugFolderName].hasOwnProperty('id')) {
          this.$eventHub.$emit(
            'socketio.folder_created_or_updated',
            content[slugFolderName]
          );
        }
      }

      window.store[type] = Object.assign({}, window.store[type], content);
      this.$eventHub.$emit(`socketio.${type}.folder_listed`);
    },

    // for projects, authors and publications
    _onListFolders(data) {
      console.log('Received _onListFolders packet.');

      if (typeof data !== 'object') {
        return;
      }

      let type = Object.keys(data)[0];
      let content = Object.values(data)[0];

      console.log(`Type is ${type}`);

      // to prevent override of fully formed medias in folders, we copy back the ones we have already
      for (let slugFolderName in content) {
        if (
          window.store[type].hasOwnProperty(slugFolderName) &&
          window.store[type][slugFolderName].hasOwnProperty('medias')
        ) {
          content[slugFolderName].medias =
            window.store[type][slugFolderName].medias;
        }
      }
      window.store[type] = Object.assign({}, content);

      this.$eventHub.$emit(`socketio.${type}.folders_listed`);
    },
    _onNewNetworkInfos(data) {
      console.log('Received _onNewNetworkInfos packet.');
      window.state.localNetworkInfos = data;
    },
    _onNotify({ localized_string, not_localized_string }) {
      console.log('Received _onNotify packet.');
      if (not_localized_string) {
        alertify
          .closeLogOnClick(true)
          .delay(4000)
          .log(not_localized_string);
      }
      if (localized_string) {
        alertify
          .closeLogOnClick(true)
          .delay(4000)
          .log(this.$t(`notifications['${localized_string}']`));
      }
    },
    listFolders(fdata) {
      if (!this.socket) return;
      this.socket.emit('listFolders', fdata);
    },
    listFolder(fdata) {
      if (!this.socket) return;
      this.socket.emit('listFolder', fdata);
    },
    createFolder(fdata) {
      if (!this.socket) return;
      this.socket.emit('createFolder', fdata);
    },
    editFolder(fdata) {
      if (!this.socket) return;
      this.socket.emit('editFolder', fdata);
    },
    removeFolder(fdata) {
      if (!this.socket) return;
      this.socket.emit('removeFolder', fdata);
    },

    listMedias(mdata) {
      if (!this.socket) return;
      this.socket.emit('listMedias', mdata);
    },
    createMedia(mdata) {
      if (!this.socket) return;
      this.socket.emit('createMedia', mdata);
    },
    editMedia(mdata) {
      if (!this.socket) return;
      this.socket.emit('editMedia', mdata);
    },
    removeMedia(mdata) {
      if (!this.socket) return;
      this.socket.emit('removeMedia', mdata);
    },
    listSpecificMedias(mdata) {
      if (!this.socket) return;
      this.socket.emit('listSpecificMedias', mdata);
    },
    downloadPubliPDF(pdata) {
      if (!this.socket) return;
      this.socket.emit('downloadPubliPDF', pdata);
    },
    downloadVideoPubli(pdata) {
      if (!this.socket) return;
      this.socket.emit('downloadVideoPubli', pdata);
    },
    updateNetworkInfos() {
      if (!this.socket) return;
      this.socket.emit('updateNetworkInfos');
    }
  }
});

import App from './App.vue';

let vm = new Vue({
  // eslint-disable-line no-new
  i18n,
  el: '#app',
  components: { App },
  template: `
    <App
    />
  `,
  data: {
    store: window.store,
    state: window.state,

    justCreatedFolderID: false,
    justCreatedMediaID: false,

    media_modal: {
      open: false,
      minimized: false,
      show_sidebar: true,
      current_slugLayerName: false,
      current_metaFileName: false
    },

    config: {
      // exemple de contenu :
      /* layers: [
        { slugLayerName: plop, ordre: 0, opacite: .2 },
        { slugLayerName: plop2, ordre: 0, opacite: .2 }
      ]
      */
      layers_options2: {},

      layers_order: [],
      // utilisé par dnd dans la sidebar pour simuler le rendu des
      // calques à droite sans affecter la liste de la sidebar
      temp_layers_order: []
    },

    // persistant, par device (dans le localstorage)
    settings: {
      has_modal_opened: false,
      sidebar: {
        view: 'Layers',
        layer_viewed: false
      },
      mode_perspective: false,
      perspective_stretch: 100,

      highlight_media: '',
      layer_filter: {
        keyword: false,
        author: false
      },

      windowHeight: window.innerHeight,
      windowWidth: window.innerWidth
    },
    currentSort: {
      field: 'date_created',
      type: 'date',
      order: 'descending'
    },

    lang: {
      available: lang_settings.available,
      current: lang_settings.current
    }
  },
  created() {
    if (window.state.dev_mode === 'debug') {
      console.log('ROOT EVENT: created');
    }
    if (this.settings.enable_system_bar) {
      document.body.classList.add('has_systembar');
    }

    if (!window.state.is_electron && this.state.session_password !== '') {
      if (window.state.dev_mode === 'debug') {
        console.log('ROOT EVENT: created / checking for password');
      }

      function hashCode(s) {
        return s.split('').reduce(function(a, b) {
          a = (a << 5) - a + b.charCodeAt(0);
          return a & a;
        }, 0);
      }

      let pass = '';

      if (
        !(
          !!localStorage.getItem('session_password') &&
          localStorage.getItem('session_password') ===
            this.state.session_password
        )
      ) {
        const pass = window.prompt(this.$t('input_password'));
        if (this.state.session_password !== hashCode(pass) + '') {
          return;
        }
        localStorage.setItem('session_password', hashCode(pass));
      }
    }

    window.addEventListener('resize', () => {
      this.settings.windowWidth = window.innerWidth;
      this.settings.windowHeight = window.innerHeight;
    });

    function tryParseJSON(jsonString) {
      try {
        var o = JSON.parse(jsonString);
        if (o && typeof o === 'object') {
          return o;
        }
      } catch (e) {}
      return false;
    }

    // check si localstorage config
    if (!!localStorage.getItem('config.layers_order')) {
      if (tryParseJSON(localStorage.getItem('config.layers_order'))) {
        this.config.layers_order = JSON.parse(
          localStorage.getItem('config.layers_order')
        );
      }
    }

    if (!!localStorage.getItem('config.layers_options2')) {
      if (tryParseJSON(localStorage.getItem('config.layers_options2'))) {
        const localConfig = JSON.parse(
          localStorage.getItem('config.layers_options2')
        );
        if (Object.keys(localConfig).length > 0) {
          this.config.layers_options2 = localConfig;
        }
      }
    }

    this.$eventHub.$on(`socketio.layers.folders_listed`, () => {
      this.$nextTick(() => {
        if (
          this.sortedLayersSlugs.filter(
            s => this.config_getLayerOption(s, 'visibility') === true
          ).length < 3
        ) {
          this.sortedLayersSlugs
            .slice(0, 3)
            .map(s => this.config_setLayerOption(s, 'visibility', true));
        }
        this.loadVisibleLayersMedias();
      });
    });

    /* à la connexion/reconnexion, détecter si un projet ou une publi sont ouverts 
    et si c’est le cas, rafraichir leur contenu (meta, medias) */
    this.$eventHub.$on('socketio.reconnect', () => {
      this.loadVisibleLayersMedias();

      if (this.settings.sidebar.view === 'Layer') {
        this.$socketio.listFolder({
          type: 'layers',
          slugFolderName: this.settings.sidebar.layer_viewed
        });

        this.$socketio.listMedias({
          type: 'layers',
          slugFolderName: this.settings.sidebar.layer_viewed
        });
      }
    });

    window.addEventListener('tag.newTagDetected', this.newTagDetected);

    if (this.state.mode === 'live') {
      console.log('ROOT EVENT: created / now connecting with socketio');
      this.$socketio.connect();
    }
  },
  beforeDestroy() {},
  watch: {
    'settings.has_modal_opened': function() {
      if (window.state.dev_mode === 'debug') {
        console.log(
          `ROOT EVENT: var has changed: has_modal_opened: ${
            this.settings.has_modal_opened
          }`
        );
      }
      if (this.has_modal_opened) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    },
    'store.authors': function() {
      if (window.state.dev_mode === 'debug') {
        console.log(`ROOT EVENT: var has changed: store.authors`);
      }
      // check if, when store.authors refresh, the current_author is still there
      // delog if not
      if (
        this.settings.current_author &&
        !this.store.authors.hasOwnProperty(
          this.settings.current_author.slugFolderName
        )
      ) {
        this.unsetAuthor();
      }
    },
    'config.layers_options2': {
      handler() {
        localStorage.setItem(
          'config.layers_options2',
          JSON.stringify(this.config.layers_options2)
        );
      },
      deep: true
    },
    'config.layers_order': function() {
      localStorage.setItem(
        'config.layers_order',
        JSON.stringify(this.config.layers_order)
      );
    }
  },
  computed: {
    sortedLayersSlugs: function() {
      var sortable = [];

      if (!this.store.layers || Object.keys(this.store.layers).length === 0) {
        return [];
      }

      for (let slugLayerName in this.store.layers) {
        let orderBy;

        if (this.currentSort.type === 'date') {
          orderBy = +this.$moment(
            this.store.layers[slugLayerName][this.currentSort.field],
            'YYYY-MM-DD HH:mm:ss'
          );
        } else if (this.currentSort.type === 'alph') {
          orderBy = this.store.layers[slugLayerName][this.currentSort.field];
        }

        sortable.push({ slugLayerName, orderBy });
        // if(this.$root.settings.layer_filter.keyword === false && this.$root.settings.layer_filter.author === false) {
        //   sortable.push({ slugLayerName, orderBy });
        //   continue;
        // }

        // if(this.$root.settings.layer_filter.keyword !== false && this.$root.settings.layer_filter.author !== false) {
        //   // only add to sorted array if layer has this keyword
        //   if(this.store.layers[slugLayerName].hasOwnProperty('keywords')
        //     && typeof this.store.layers[slugLayerName].keywords === 'object'
        //     && this.store.layers[slugLayerName].keywords.filter(k => k.title === this.$root.settings.layer_filter.keyword).length > 0) {

        //     if(this.store.layers[slugLayerName].hasOwnProperty('authors')
        //       && typeof this.store.layers[slugLayerName].authors === 'object'
        //       && this.store.layers[slugLayerName].authors.filter(k => k.name === this.$root.settings.layer_filter.author).length > 0) {

        //       sortable.push({ slugLayerName, orderBy });
        //     }
        //   }
        //   continue;
        // }
        // // if a layer keyword filter is set
        // if(this.$root.settings.layer_filter.keyword !== false) {
        //   // only add to sorted array if layer has this keyword
        //   if(this.store.layers[slugLayerName].hasOwnProperty('keywords')
        //     && typeof this.store.layers[slugLayerName].keywords === 'object'
        //     && this.store.layers[slugLayerName].keywords.filter(k => k.title === this.$root.settings.layer_filter.keyword).length > 0) {
        //     sortable.push({ slugLayerName, orderBy });
        //   }
        //   continue;
        // }

        // if(this.$root.settings.layer_filter.author !== false) {
        //   // only add to sorted array if layer has this keyword
        //   if(this.store.layers[slugLayerName].hasOwnProperty('authors')
        //     && typeof this.store.layers[slugLayerName].authors === 'object'
        //     && this.store.layers[slugLayerName].authors.filter(k => k.name === this.$root.settings.layer_filter.author).length > 0) {
        //     sortable.push({ slugLayerName, orderBy });
        //   }
        //   continue;
        // }
      }

      // if there is no layer in sortable, it is probable that filters
      // were too restrictive
      if (sortable.length === 0) {
        // lets remove filters if there are any
        this.$nextTick(() => {
          // this.$root.settings.layer_filter.keyword = false;
        });
      }
      sortable = sortable
        .sort(function(a, b) {
          let valA = a.orderBy;
          let valB = b.orderBy;
          if (typeof a.orderBy === 'string' && typeof b.orderBy === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
          }
          if (valA < valB) {
            return -1;
          }
          if (valA > valB) {
            return 1;
          }
          return 0;
        })
        .map(s => s.slugLayerName);

      if (this.currentSort.order === 'descending') {
        sortable.reverse();
      }

      // si on a un ordre de défini, on part là-dessus puis on le complète avec sortable
      if (this.config.layers_order.length > 0) {
        sortable.map(s => {
          if (!this.config.layers_order.includes(s)) {
            this.config.layers_order.unshift(s);
          }
        });
        return this.config.layers_order;
      }

      return sortable;

      // return sortable.reduce((accumulator, d) => {
      //   let sortedMediaObj = this.store.layers[d.slugLayerName];
      //   accumulator.push(sortedMediaObj);
      //   return accumulator;
      // }, []);
    },
    allKeywords() {
      let allKeywords = [];
      for (let slugLayerName in this.store.projects) {
        let layerKeywords = this.store.projects[slugLayerName].keywords;
        if (!!layerKeywords) {
          layerKeywords.map(val => {
            allKeywords.push(val.title);
          });
        }
      }
      allKeywords = allKeywords.filter(function(item, pos) {
        return allKeywords.indexOf(item) == pos;
      });

      return allKeywords.map(kw => {
        return {
          text: kw,
          classes: 'tagcolorid_' + (parseInt(kw, 36) % 2)
        };
      });
    }
  },
  methods: {
    createFolder: function(fdata) {
      if (window.state.dev_mode === 'debug') {
        console.log(
          `ROOT EVENT: createfolder: ${JSON.stringify(fdata, null, 4)}`
        );
      }

      this.justCreatedFolderID = fdata.id =
        Math.random()
          .toString(36)
          .substring(2, 15) +
        Math.random()
          .toString(36)
          .substring(2, 15);

      this.$socketio.createFolder(fdata);
    },
    editFolder: function(fdata) {
      if (window.state.dev_mode === 'debug') {
        console.log(
          `ROOT EVENT: editFolder: ${JSON.stringify(fdata, null, 4)}`
        );
      }
      this.$socketio.editFolder(fdata);
    },
    removeFolder: function({ type, slugFolderName }) {
      if (window.state.dev_mode === 'debug') {
        console.log(
          `ROOT EVENT: removeFolder: slugFolderName = ${slugFolderName} of type = ${type}`
        );
      }
      this.$socketio.removeFolder({ type, slugFolderName });
    },
    createMedia: function(mdata) {
      if (window.state.dev_mode === 'debug') {
        console.log(`ROOT EVENT: createMedia`);
      }
      this.justCreatedMediaID = mdata.id =
        Math.random()
          .toString(36)
          .substring(2, 15) +
        Math.random()
          .toString(36)
          .substring(2, 15);

      this.$nextTick(() => {
        this.$socketio.createMedia(mdata);
      });
    },

    removeMedia: function(mdata) {
      if (window.state.dev_mode === 'debug') {
        console.log(
          `ROOT EVENT: removeMedia: ${JSON.stringify(mdata, null, 4)}`
        );
      }
      this.$socketio.removeMedia(mdata);
    },
    editMedia: function(mdata) {
      if (window.state.dev_mode === 'debug') {
        console.log(`ROOT EVENT: editMedia: ${JSON.stringify(mdata, null, 4)}`);
      }
      this.$socketio.editMedia(mdata);
    },

    openLayer: function(slugLayerName) {
      if (window.state.dev_mode === 'debug') {
        console.log(`ROOT EVENT: openLayer: ${slugLayerName}`);
      }
      if (!this.store.layers.hasOwnProperty(slugLayerName)) {
        console.log('Missing layer key on the page, aborting.');
        return false;
      }

      this.settings.sidebar.view = 'Layer';
      this.settings.sidebar.layer_viewed = slugLayerName;

      this.$socketio.listMedias({
        type: 'layers',
        slugFolderName: slugLayerName
      });
    },
    closeLayer: function() {
      if (window.state.dev_mode === 'debug') {
        console.log('ROOT EVENT: closeLayer');
      }
      this.settings.sidebar.view = 'Layers';
      this.settings.sidebar.layer_viewed = false;
    },
    previewURL(layer, width = 1600) {
      if (!layer.hasOwnProperty('preview') || layer.preview === '') {
        return false;
      }
      const thumb = layer.preview.filter(p => p.size === width);
      if (thumb.length > 0) {
        return `${thumb[0].path}?${new Date().getTime()}`;
      }
      return false;
    },
    openMedia({ slugLayerName, metaFileName }) {
      if (window.state.dev_mode === 'debug') {
        console.log(
          `ROOT EVENT: openMedia with slugLayerName = ${slugLayerName} and metaFileName = ${metaFileName}`
        );
      }

      if (this.media_modal.open === true) {
        this.closeMedia();

        this.$nextTick(() => {
          this.media_modal.open = true;
          this.media_modal.minimized = false;
          this.media_modal.current_slugLayerName = slugLayerName;
          this.media_modal.current_metaFileName = metaFileName;
        });

        return;
      }

      this.media_modal.open = true;
      this.media_modal.minimized = false;
      this.media_modal.current_slugLayerName = slugLayerName;
      this.media_modal.current_metaFileName = metaFileName;
    },
    closeMedia: function() {
      if (window.state.dev_mode === 'debug') {
        console.log(`ROOT EVENT: closeMedia`);
      }

      this.media_modal.open = false;
      this.media_modal.current_slugLayerName = false;
      this.media_modal.current_metaFileName = false;
    },
    setProjectKeywordFilter(newKeywordFilter) {
      if (this.settings.layer_filter.keyword !== newKeywordFilter) {
        this.settings.layer_filter.keyword = newKeywordFilter;
      } else {
        this.settings.layer_filter.keyword = false;
      }
    },
    setProjectAuthorFilter(newAuthorFilter) {
      if (this.settings.layer_filter.author !== newAuthorFilter) {
        this.settings.layer_filter.author = newAuthorFilter;
      } else {
        this.settings.layer_filter.author = false;
      }
    },
    setMediaKeywordFilter(newKeywordFilter) {
      if (this.settings.media_filter.keyword !== newKeywordFilter) {
        this.settings.media_filter.keyword = newKeywordFilter;
      } else {
        this.settings.media_filter.keyword = false;
      }
    },
    setMediaAuthorFilter(newAuthorFilter) {
      if (this.settings.media_filter.author !== newAuthorFilter) {
        this.settings.media_filter.author = newAuthorFilter;
      } else {
        this.settings.media_filter.author = false;
      }
    },
    setFavAuthorFilter(newFavFilter) {
      this.settings.media_filter.fav = !this.settings.media_filter.fav;
    },

    resetConfig() {
      this.config.layers_order = [];
      this.config.layers_options2 = {};
      // Object.keys(this.config.layers_options2).map(k => {
      //   let opt = this.config.layers_options2[k];
      //   Object.keys(opt).map(s => {
      //     this.$delete(this.config.layers_options2[k], s);
      //   });
      // });
    },
    loadVisibleLayersMedias() {
      this.sortedLayersSlugs
        .filter(s => this.config_getLayerOption(s, 'visibility') === true)
        .map(s => {
          this.$socketio.listFolder({
            type: 'layers',
            slugFolderName: s
          });
          this.$socketio.listMedias({
            type: 'layers',
            slugFolderName: s
          });
        });
    },

    isMediaShown(media) {
      if (this.settings.media_filter.fav === true) {
        if (!media.fav) {
          return false;
        }
      }

      if (
        this.settings.media_filter.keyword === false &&
        this.settings.media_filter.author === false
      ) {
        return true;
      }

      if (
        this.settings.media_filter.keyword !== false &&
        this.settings.media_filter.author !== false
      ) {
        // only add to sorted array if project has this keyword
        if (
          media.hasOwnProperty('keywords') &&
          typeof media.keywords === 'object' &&
          media.keywords.filter(
            k => k.title === this.settings.media_filter.keyword
          ).length > 0
        ) {
          if (
            media.hasOwnProperty('authors') &&
            typeof media.authors === 'object' &&
            media.authors.filter(
              k => k.name === this.settings.media_filter.author
            ).length > 0
          ) {
            return true;
          }
        }
        return false;
      }
      // if a project keyword filter is set
      if (this.settings.media_filter.keyword !== false) {
        // only add to sorted array if project has this keyword
        if (
          media.hasOwnProperty('keywords') &&
          typeof media.keywords === 'object' &&
          media.keywords.filter(
            k => k.title === this.settings.media_filter.keyword
          ).length > 0
        ) {
          return true;
        }
        return false;
      }

      if (this.settings.media_filter.author !== false) {
        // only add to sorted array if project has this keyword
        if (
          media.hasOwnProperty('authors') &&
          typeof media.authors === 'object' &&
          media.authors.filter(
            k => k.name === this.settings.media_filter.author
          ).length > 0
        ) {
          return true;
        }
        return false;
      }
      // END MEDIA FILTER LOGIC
    },
    updateLocalLang: function(newLangCode) {
      if (window.state.dev_mode === 'debug') {
        console.log('ROOT EVENT: updateLocalLang');
      }
      i18n.locale = newLangCode;
      moment.locale(newLangCode);
      this.lang.current = newLangCode;

      const html = document.documentElement; // returns the html tag
      html.setAttribute('lang', newLangCode);

      localstore.set('language', newLangCode);
    },
    listSpecificMedias(mdata) {
      if (window.state.dev_mode === 'debug') {
        console.log(
          `ROOT EVENT: listSpecificMedias with medias_list = ${JSON.stringify(
            mdata,
            null,
            4
          )}`
        );
      }
      this.$socketio.listSpecificMedias(mdata);
    },

    switchLang() {
      if (window.state.dev_mode === 'debug') {
        console.log(`ROOT EVENT: switchLang`);
      }
      if (this.lang.current === 'fr') {
        this.updateLocalLang('en');
      } else {
        this.updateLocalLang('fr');
      }
    },

    newTagDetected(e) {
      if (window.state.dev_mode === 'debug') {
        console.log(`ROOT EVENT: newTagDetected with e.detail = ${e.detail}`);
      }

      if (!(e.detail.indexOf('data') === 0 || e.detail.indexOf('dqtq') === 0)) {
        return;
      }

      const pos_type = 4;

      // couper après M ou :, récupérer la première lettre puis couper le reste du message
      const type = e.detail.substring(pos_type, pos_type + 1);
      const value = Number(e.detail.substring(pos_type + 1));

      const dict = {
        h: 'humidite',
        t: 'temperature',
        s: 'son'
      };

      alertify
        .closeLogOnClick(true)
        .maxLogItems(3)
        .delay(4000)
        .log('Nouvelle valeur : ' + dict[type] + ' = ' + value);

      // this.createPinFromData({
      //   type: dict[type],
      //   value
      // });
    },

    createPinFromData({ type, value }) {
      this.getLocationConstant()
        .then(event => {
          this.$root.createMedia({
            slugFolderName: type,
            type: 'layers',
            additionalMeta: {
              latitude: event.coords.latitude,
              longitude: event.coords.longitude,
              value,
              type: 'other'
            }
          });
        })
        .catch(event => {
          this.$alertify
            .closeLogOnClick(true)
            .delay(4000)
            .error(
              this.$t('notifications.geoloc_failed') +
                ' ' +
                this.$t('error_code') +
                event.code +
                '. ' +
                event.message
            );
        });
    },

    getLocationConstant() {
      return new Promise(function(resolve, reject) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        } else {
          this.$alertify
            .closeLogOnClick(true)
            .delay(4000)
            .error(this.$t('notifications.your_device_cant_geoloc'));
        }
      });
    },

    loadAllProjectsMedias() {
      if (window.state.dev_mode === 'debug') {
        console.log(`ROOT EVENT: loadAllProjectsMedias`);
      }

      Object.keys(this.store.layers).forEach(slugLayerName => {
        const project_meta = this.store.layers[slugLayerName];
        this.$socketio.listMedias({
          type: 'layers',
          slugFolderName: slugLayerName
        });
      });
    },
    formatDateToHuman(date) {
      return this.$moment(date, 'YYYY-MM-DD HH:mm:ss').format('LL');
    },
    config_setLayerOption(slugLayerName, type, value) {
      console.log(
        'config_setLayerOption for ' +
          slugLayerName +
          ' for type ' +
          type +
          ' with value ' +
          value
      );

      if (type === 'visibility' && value === true) {
        this.$socketio.listMedias({
          type: 'layers',
          slugFolderName: slugLayerName
        });
      }
      if (!this.config.layers_options2.hasOwnProperty(slugLayerName)) {
        this.$set(this.config.layers_options2, slugLayerName, {});
      }
      if (!this.config.layers_options2[slugLayerName].hasOwnProperty(type)) {
        this.$set(this.config.layers_options2[slugLayerName], type, value);
        return;
      }
      this.config.layers_options2[slugLayerName][type] = value;
    },
    config_getLayerOption(slugLayerName, type) {
      if (
        this.config.layers_options2.hasOwnProperty(slugLayerName) &&
        this.config.layers_options2[slugLayerName].hasOwnProperty(type)
      ) {
        return this.config.layers_options2[slugLayerName][type];
      }
      return;
    }
  }
});
