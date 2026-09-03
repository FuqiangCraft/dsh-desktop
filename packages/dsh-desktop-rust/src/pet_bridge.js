(() => {
  const invoke = (command, args = {}) => window.__TAURI__.core.invoke(command, args)
  const characterListeners = new Set()
  const sizeListeners = new Set()
  const opacityListeners = new Set()
  const stateListeners = new Set()
  let character = 'robot'
  let size = 100
  let opacity = 100
  let state = { state: 'idle', text: '' }

  window.__DSH_DESKTOP_BRIDGE__ = {
    readPetResource: (name) => invoke('read_pet_resource', { name }),
    onPetCharacter: (listener) => {
      characterListeners.add(listener); listener(character)
      return () => characterListeners.delete(listener)
    },
    onPetSize: (listener) => {
      sizeListeners.add(listener); listener(size)
      return () => sizeListeners.delete(listener)
    },
    onPetOpacity: (listener) => {
      opacityListeners.add(listener); listener(opacity)
      return () => opacityListeners.delete(listener)
    },
    onPetState: (listener) => {
      stateListeners.add(listener); listener(state.state, state.text)
      return () => stateListeners.delete(listener)
    },
  }

  window.__DSH_RUST_SET_PET_CHARACTER__ = (value) => {
    character = value
    for (const listener of characterListeners) listener(value)
  }
  window.__DSH_RUST_SET_PET_SIZE__ = (value) => {
    size = value
    for (const listener of sizeListeners) listener(value)
  }
  window.__DSH_RUST_SET_PET_OPACITY__ = (value) => {
    opacity = value
    for (const listener of opacityListeners) listener(value)
  }
  window.__DSH_RUST_SET_PET_STATE__ = (nextState, text = '') => {
    state = { state: nextState, text }
    for (const listener of stateListeners) listener(nextState, text)
  }
})()
