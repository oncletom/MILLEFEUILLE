<template>
  <div class="m_controller" style="">
    <div class="m_controller--topBar">
      <div class="padding-vert-medium padding-sides-medium">
        <h1 class="margin-none">millefeuille</h1>
        <small class="margin-none">
          workshop «&nbsp;données situées et cartographie sensible&nbsp;»
          <br><b>île de&nbsp;Nantes</b> — 
          décembre 2018
        </small>
        <br>    
        <button type="button" class="buttonLink margin-left-none padding-left-none"
          @click="showCreditsModal = true"
        >
          informations
        </button>

        <Credits
          v-if="showCreditsModal"
          @close="showCreditsModal = false"
          :read_only="!$root.state.connected"
        />

      </div>
      <!-- <div class="mode_switcher border-bottom">
        <label for="image" class="padding-vert-small padding-sides-medium">
          <input type="radio" id="image" value="Image" v-model="current_options_mode">
          <span>1. Settings</span>
        </label>
        <label for="motif" class="padding-small padding-sides-medium">
          <input type="radio" id="motif" value="Motif" v-model="current_options_mode">
          <span>2. Design</span>
        </label>
      </div> -->

    </div>      

    <div class="m_controller--content">
      <transition name="slideToLeft">
        <div class="panel panel_image" v-show="$root.settings.sidebar.view === 'Layers'">
          <label class="margin-vert-verysmall margin-sides-medium">{{ $t('layer_list') }}</label>

          <Container 
            @drop="onDrop" 
            @drop-ready="onDropReady"
            @drag-end="onDragend"
            drag-handle-selector=".column-drag-handle" 
            drag-class="is--being_handled"
          >
            <Draggable v-for="slugLayerName in $root.sortedLayersSlugs" :key="slugLayerName">
              <LayerHeader
                v-if="$root.store.layers.hasOwnProperty(slugLayerName)"
                :layer="$root.store.layers[slugLayerName]"
                :slugLayerName="slugLayerName"
                :saved_opts="load_layer_opts(slugLayerName)"
              />

              <!-- <Card :type="'section_separator'">
                <div slot="header">
                  {{ layer.slugFolderName }}
                </div>
              </Card> -->
            </Draggable>
          </Container>
        </div>
      </transition>

      <transition name="slideFromLeft">
        <div
          class="panel panel_pattern"
          v-if="$root.settings.sidebar.view === 'Layer'"
        >
          <label class="margin-vert-verysmall margin-sides-medium">{{ $t('layer') }}</label>
          <LayerPanel
            :layer="current_layer"
            :slugLayerName="current_layer.slugFolderName"
          />
        </div>
      </transition>
    </div>


    <div class="m_controller--bottomBar">

      <!-- {{ $root.config.layers_options2 }} -->

      <transition name="slideFromBottom" mode="out-in" :duration="500">
        <div v-if="$root.settings.sidebar.view === 'Layers'"
          :key="'layers_options2'"
        >
          <div class="margin-bottom-verysmall" v-if="Object.keys(this.$root.config.layers_options2).length > 0 || this.$root.config.layers_order.length > 0">
            <button type="button" class="btn_small bg-transparent " @click="$root.resetConfig()">
              RESET
            </button>
          </div>

          <button
            class="barButton barButton_createLayer"
            v-if="!showCreateLayerModal"
            @click="showCreateLayerModal = true"
            :disabled="!$root.state.connected"
            :key="'createButton'"
          >
            <span>
              {{ $t('create_a_layer') }}
            </span>
          </button>
          <CreateLayer
            v-if="$root.settings.sidebar.view === 'Layers' && showCreateLayerModal"
            @close="showCreateLayerModal = false"
            :read_only="!$root.state.connected"
          />
        </div>
        <div v-else-if="$root.settings.sidebar.view === 'Layer'"
          :key="'layer_options'"
        >
          <button
            class="barButton barButton_addData"
            @click="showCreateMediaModal = true"
            :disabled="!$root.state.connected"
            :key="'createButton'"
          >
            <span>
              {{ $t('add_data') }}
            </span>
          </button>

          <CreateMedia
            v-if="showCreateMediaModal"
            @close="showCreateMediaModal = false"
            :slugLayerName="$root.settings.sidebar.layer_viewed"
            :read_only="!$root.state.connected"
          />

          <button
            class="btn_small"
            @click="showCreateMediaFromCSVModal = true"
            :disabled="!$root.state.connected"
            :key="'createSVGButton'"
          >
            <span>
              {{ $t('add_data_from_CSV') }}
            </span>
          </button>

          <CreateMediaFromCSV
            v-if="showCreateMediaFromCSVModal"
            @close="showCreateMediaFromCSVModal = false"
            :slugLayerName="$root.settings.sidebar.layer_viewed"
            :read_only="!$root.state.connected"
          />        

        </div>
      </transition>

    </div>

    <EditMedia
      v-if="$root.media_modal.open"
      :slugLayerName="$root.media_modal.current_slugLayerName"
      :slugMediaName="$root.media_modal.current_metaFileName"
      :media="$root.store.layers[$root.media_modal.current_slugLayerName].medias[$root.media_modal.current_metaFileName]"
      @close="$root.closeMedia()"
      :read_only="!$root.state.connected"
    />

  </div>
</template>

<script>
import Card from './subcomponents/Card.vue';
import { Container, Draggable } from 'vue-smooth-dnd'
import CreateLayer from './modals/CreateLayer.vue';
import CreateMedia from './modals/CreateMedia.vue';
import CreateMediaFromCSV from './modals/CreateMediaFromCSV.vue';
import LayerPanel from './subcomponents/LayerPanel.vue';
import EditMedia from './modals/EditMedia.vue'
import LayerHeader from './subcomponents/LayerHeader.vue';
import Credits from './modals/Credits.vue'

const applyDrag = (arr, dragResult) => {
  const { removedIndex, addedIndex, payload } = dragResult
  if (removedIndex === null && addedIndex === null) return arr

  const result = [...arr]
  let itemToAdd = payload

  if (removedIndex !== null) {
    itemToAdd = result.splice(removedIndex, 1)[0]
  }

  if (addedIndex !== null) {
    result.splice(addedIndex, 0, itemToAdd)
  }

  return result
}

export default {
  props: ['layers'],
  components: {
    Container, 
    Draggable,
    CreateLayer,
    LayerPanel,
    Card,
    CreateMedia,
    CreateMediaFromCSV,
    EditMedia,
    LayerHeader,
    Credits
  },
  data () {
    return {
      showCreateLayerModal: false,
      showCreateMediaModal: false,      
      showCreateMediaFromCSVModal: false,
      showCreditsModal: false
    }
  },
  computed: {
    current_layer() {
      if(this.$root.settings.sidebar.layer_viewed && this.layers.hasOwnProperty(this.$root.settings.sidebar.layer_viewed)) {
        return this.layers[this.$root.settings.sidebar.layer_viewed];
      }
      return false;
    },
  },
  methods: {
    onDrop(dropResult) {
      this.$root.config.layers_order = applyDrag(this.$root.sortedLayersSlugs, dropResult);
      // const layers_in_order = applyDrag(this.$root.layers, dropResult)
      this.$root.config.temp_layers_order = [];
    },
    onDropReady(dropResult) {
      this.$root.config.temp_layers_order = applyDrag(this.$root.sortedLayersSlugs, dropResult);
    },
    onDragend(dropResult) {
      this.$root.config.temp_layers_order = [];
    },
    load_layer_opts(slugLayerName) {
      let opt = {};
      if(Object.keys(this.$root.config.layers_options2).length === 0 || !this.$root.config.layers_options2.hasOwnProperty(slugLayerName)) {
        return opt;
      }
      return this.$root.config.layers_options2[slugLayerName];
    }
  }
}



</script>
<style lang="less">
</style>