  missingHeaders.length).setValues([missingHeaders]);
          Logger.log(`Colonnes manquantes ajoutées à '${name}': ${missingHeaders.join(', ')}`);
        }
      }
    });
    ui.alert('Mise à jour du système client terminée avec succès !');
  } catch (e) {
    Logger.log(e);
    ui.alert('Erreur lors de la mise à jour', e.message, ui.ButtonSet.OK);
  }
}
