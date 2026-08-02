import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

// Redimensiona y comprime la imagen y devuelve { base64, mediaType } (base64 sin prefijo).
async function procesar(uri) {
  const manip = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 900 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return { base64: manip.base64, mediaType: "image/jpeg" };
}

export async function tomarFotoComida() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permiso necesario", "Permití el acceso a la cámara para sacar la foto.");
    return null;
  }
  const r = await ImagePicker.launchCameraAsync({ quality: 1 });
  if (r.canceled) return null;
  return procesar(r.assets[0].uri);
}

export async function elegirFotoComida() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permiso necesario", "Permití el acceso a las fotos para elegir una imagen.");
    return null;
  }
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
  });
  if (r.canceled) return null;
  return procesar(r.assets[0].uri);
}
